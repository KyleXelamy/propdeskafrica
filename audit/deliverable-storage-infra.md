# Deliverable — Storage privacy, RPC grant lockdown, CSP, next.js patch

**Track:** `harden-storage-infra` · **Agent:** Coder · **Date:** 2026-10-29
**Repo:** `/workspace/propdesk` (baseline commit `467c500`)

---

## 1. Finding status

| Finding | Sev | Status | Why |
|---|---|---|---|
| **CRYPTO-005** — `documents` bucket is PUBLIC | CRITICAL | **FIXED** | Bucket is created/forced `public = false`; policies are owner-scoped and now meaningful; every read goes through a 5-minute signed URL bound to the requesting owner. |
| **INFRA-013** — documents + photos in a public bucket | HIGH | **FIXED** | Same change; `documents.file_url` now stores the Storage **object path**, not a URL. Legacy rows holding a public URL are still served (URL → path → signed URL). |
| **CRYPTO-006** — property photos bypass the storage policy | HIGH | **FIXED** | Photo path changed to `{userId}/property-photos/{propertyId}/{uuid}.{ext}` so it satisfies the owner-prefix policy; upload now uses the **user-scoped** client (service role dropped); property ownership is verified **before** the upload; reads are signed URLs. |
| **INFRA-016** — SECURITY DEFINER RPCs executable by anon/authenticated | HIGH | **FIXED** | `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated` + `GRANT … TO service_role` on both functions, and both now pin `SET search_path = public, pg_temp`. Function bodies unchanged. |
| **INFRA-021** — next 16.3.8 in the RCE/DoS advisory range | CRITICAL | **FIXED** | `next` `^16.3.8` → `^16.4.3`; `node_modules`, `package-lock.json` **and** `pnpm-lock.yaml` updated; `npm audit` no longer reports the three advisories; build + tests + tsc all pass. |
| **IND-010** — no Content-Security-Policy, incomplete HSTS | MEDIUM | **PARTIAL (deliberate)** | A CSP now ships — but as **`Content-Security-Policy-Report-Only`**, because an enforcing policy without a per-request nonce would break the app (Next injects inline bootstrap scripts). HSTS is fully hardened (`includeSubDomains; preload`). Exact switch-over procedure in §6. |
| **INFRA-010** — "no CSP anywhere" (same defect as IND-010) | MEDIUM | **PARTIAL (same reason)** | A policy exists and is being collected against; it is not yet enforcing. |
| **INFRA-014** — upload validates neither content type nor magic bytes | MEDIUM | **PARTIAL** | Content-type allowlist + extension allowlist + magic-byte sniff + size limit + filename sanitisation all implemented. The `Content-Disposition: attachment` / `nosniff` part is **not** done — see §7. |
| **INFRA-015** — photo upload trusts the client MIME type, writes with the service key | MEDIUM | **PARTIAL** | Magic-byte sniff + owner-scoped client + ownership check before upload are done. Re-encoding through `sharp` is **not** done (no `sharp` dependency; out of scope). |
| **INFRA-011** — missing COOP/CORP/X-XSS-Protection | MEDIUM | **NOT MINE / WONT_FIX here** | Not in my finding list. The HSTS half of it is fixed (§3). COOP/CORP were deliberately **not** added: `Cross-Origin-Opener-Policy: same-origin` can break the Supabase/Google OAuth popup flow and `Cross-Origin-Resource-Policy` needs per-route thought because images are served from Supabase. Left for the owner. |

---

## 2. Files changed (only the files I own)

| File | Change |
|---|---|
| `supabase-setup/01-create-tables.sql` | Bucket created **private** (`ON CONFLICT (id) DO UPDATE SET public = false`), `file_size_limit` + `allowed_mime_types` set on the bucket, four storage policies rewritten as owner-scoped `USING`/`WITH CHECK` clauses with `auth.uid() IS NOT NULL`. |
| `supabase-setup/02-add-missing-columns.sql` | Same bucket + policy block kept byte-consistent with `01-create-tables.sql`. |
| `supabase-setup/12-auto-backup.sql` | `prune_old_backups()`: added `SET search_path = public, pg_temp`; revoked EXECUTE from `PUBLIC`/`anon`/`authenticated`; granted EXECUTE to `service_role` only. Body unchanged. |
| `supabase-setup/13-paybill-counters.sql` | `bump_paybill_counters(uuid, boolean)`: added `SET search_path = public, pg_temp`; revoked EXECUTE from `PUBLIC`/`anon`/`authenticated`; granted EXECUTE to `service_role` only. Body unchanged. |
| `app/api/documents/route.ts` | GET signs every `file_url` (5 min) and adds `storage_path`; POST stores the **object path** (accepts a legacy public URL and converts it) and refuses a path outside the caller's own folder. |
| `app/api/documents/[id]/route.ts` | GET/PUT return a signed `file_url` + `storage_path`; PUT can no longer persist a URL (only an in-folder path); DELETE removes the object by path. |
| `app/api/documents/upload/route.ts` | Content-type + extension allowlists, magic-byte sniff, 10 MB limit, filename sanitisation (no separators/traversal), upload through the **user-scoped** client, returns the object path (no public URL), error message no longer tells the operator to make the bucket public. |
| `app/api/properties/[id]/photos/route.ts` | GET returns signed URLs; POST verifies the property belongs to the caller **before** reading or storing anything, sniffs the image magic bytes, writes to `{userId}/property-photos/…` with the **user-scoped** client (service role removed), stores the path, returns a signed URL; DELETE removes by path (service role only for pre-fix legacy objects). The property id is validated as a UUID because it goes into the Storage object key. |
| `next.config.mjs` | Added `Content-Security-Policy-Report-Only`; HSTS → `max-age=63072000; includeSubDomains; preload`. No existing header removed or weakened. |
| `package.json` | `"next": "^16.3.8"` → `"next": "^16.4.3"`. (The `vite` devDependency line in the diff was added by the audit environment setup, not by me.) |
| `package-lock.json` | Regenerated by `npm install` (next 16.4.3 + the `vite` devDependency). |
| `pnpm-lock.yaml` | Regenerated with `corepack pnpm install --lockfile-only` (pnpm 10.34.6, the version the repo pins) — needed because `packageManager` is `pnpm@10.34.6`, so Vercel installs from this file and a stale lockfile would fail `--frozen-lockfile`. |

No new files were created; no file outside the list above was touched.

---

## 3. What changed, in detail

### 3.1 Private bucket + owner-scoped policies

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;      -- flips an existing public bucket
```
`DO UPDATE` (not `DO NOTHING`) is deliberate: re-running the script on the live project **fixes** an already-public bucket. The order of operations is in §5.

Policies (both SQL files) are now owner-scoped on **every** verb, which is what makes a private bucket safe:

```sql
CREATE POLICY "Users can read their own documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```
The SELECT policy is the one that matters now: `createSignedUrl()` is evaluated against it, so a signed URL can only ever be minted for an object inside the caller's own folder. No policy grants `anon` anything.

Bucket settings (defence in depth, no schema change):
`file_size_limit = 10485760` (10 MB, the app's own upload cap) and
`allowed_mime_types = {application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, image/jpeg, image/png, image/gif, image/webp, text/plain}`.

### 3.2 Object layout

| Kind | Path | Owner-scoped? |
|---|---|---|
| Document | `{userId}/{timestamp}-{sanitised-name}.{ext}` | yes — `foldername[1] = userId` |
| Property photo (new) | `{userId}/property-photos/{propertyId}/{uuid}.{ext}` | yes — `foldername[1] = userId` |
| Property photo (pre-fix, still on disk) | `property-photos/{userId}/{propertyId}/{uuid}.{ext}` | no — `foldername[1] = "property-photos"`. These can only be removed with the service role; the code handles that explicitly. |

A **separate** `property-photos` bucket (CRYPTO-006's suggested ideal) was **not** created: that is a storage-layout change that needs a live migration of every existing photo object, and creating a bucket the live project may not have would break uploads outright. The single private bucket with an owner-scoped path prefix satisfies the same control. See §7 for how to split it later.

### 3.3 Signed URLs

`lib/storage.ts` has `getBackupSignedUrl()` for the `backups` bucket. I do **not** own `lib/storage.ts`, so the document signed-URL helper was implemented locally in the four routes I own (same Supabase Storage API, same 600 s → shortened to **300 s**):

1. the **user-scoped** client is tried first, so the storage RLS policies are the real control;
2. if that fails (e.g. the policies have not been applied yet), the **service role** is used as a fallback — it bypasses RLS, so it is only reached after the code has verified that the path is inside the caller's own folder (`{userId}/…`);
3. the signed URL is **short-lived: 300 seconds**;
4. `file_url` in every API response is the signed URL; the raw path is also returned as `storage_path`.

**What `lib/storage.ts` should get** (owner action, one small function — I could not add it because the file is owned by another track):

```ts
// lib/storage.ts
export const DOCUMENTS_BUCKET = "documents"
export const SIGNED_URL_TTL_SECONDS = 300
export async function createDocumentSignedUrl(
  userId: string, path: string, client?: SupabaseClient,
): Promise<string | null> {
  if (!path.startsWith(`${userId}/`)) return null
  const supa = client ?? createServiceClient()
  if (!supa) return null
  const { data, error } = await supa.storage
    .from(DOCUMENTS_BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  if (error) return null
  return data?.signedUrl ?? null
}
```
and then the four route files can drop their local copy. Until that exists the helper is duplicated four times — a known wart, not a security issue.

### 3.4 Upload hardening (`app/api/documents/upload/route.ts`)

* **Content type** — allowlist of 8 types; anything else → `415`.
* **Extension** — must be one of the extensions allowed for that type (`pdf`, `doc`, `docx`, `jpg/jpeg`, `png`, `gif`, `webp`, `txt`).
* **Magic bytes** — the declared type must match the sniffed type (PNG/JPEG/GIF/WEBP/PDF/OLE2/ZIP). `text/plain` has no magic bytes, so markup at the head of the file (`<!doctype html`, `<html`, `<script`, `<svg`, …) is rejected instead.
* **Size** — 10 MB hard cap (unchanged) + empty-file rejection.
* **Filename** — the directory component is stripped (`/` and `\`), everything outside `[A-Za-z0-9._-]` becomes `_`, `..` sequences are collapsed, leading dots removed, length capped at 80. The stored extension is the **canonical** one from the validated type, never the client's.
* The upload uses the **user-scoped** client, so the storage INSERT policy applies and the object physically cannot land outside `{userId}/`.
* The stored content type is the validated one, not `file.type`.

### 3.5 RPC grants

```sql
create or replace function public.bump_paybill_counters(p_paybill_id uuid, p_matched boolean)
returns void language sql security definer set search_path = public, pg_temp as $$ … $$;

revoke execute on function public.bump_paybill_counters(uuid, boolean) from public;
revoke execute on function public.bump_paybill_counters(uuid, boolean) from anon;
revoke execute on function public.bump_paybill_counters(uuid, boolean) from authenticated;
grant  execute on function public.bump_paybill_counters(uuid, boolean) to service_role;
```
The `revoke … from public` line is the one that actually closes the hole: a `SECURITY DEFINER` function is executable by `PUBLIC` **by default**, so the old `grant execute … to service_role, anon, authenticated` never removed `anon`'s access. Same treatment for `public.prune_old_backups()`.

Legitimate callers are unaffected:
* `bump_paybill_counters` is called by the Daraja C2B callback, which uses the **service-role** client (`app/api/mpesa/c2b/confirmation/route.ts:230` → `createServiceClient()`), so `service_role` keeps EXECUTE.
* `prune_old_backups()` has **no** caller in the TypeScript code today (only `lib/system.ts` mentions it in a patch description), so nothing can break.

> The SQL was **not executed against a live Postgres** — the sandbox has no Postgres server. The scripts are additive (policies/grants/revokes/bucket settings only): no `DROP TABLE`, no `DROP COLUMN`, no data change.

### 3.6 CSP + HSTS

See §6 for the exact header value.

---

## 4. Commands I ran, and their real output

```
$ npx tsc --noEmit            # BEFORE my changes
52 errors (all pre-existing; the audit baseline is 54 — two had already been fixed by other agents)
   16 app/api/templates/[id]/preview/route.ts
   10 app/dashboard/damages/page.tsx
    6 app/api/stripe/webhook/route.ts
    5 app/api/paybill/test-payment/route.ts
    5 app/api/paybill/route.ts
    3 components/dashboard-sidebar.tsx
    2 app/manifest.ts
    1 components/paybill-account-form.tsx
    1 app/dashboard/reconciliation/page.tsx
    1 app/dashboard/contacts/page.tsx
    1 app/dashboard/company/page.tsx
    1 app/dashboard/billing/page.tsx
```

```
$ npx tsc --noEmit            # AFTER my changes
52 errors — identical list, identical count.
$ npx tsc --noEmit | grep -E "app/api/documents|app/api/properties/\[id\]/photos|next.config"
(no output)  →  ZERO new errors from my files.
```

```
$ npm test                    # BEFORE
 Test Files  2 passed (2)
      Tests  30 passed (30)

$ npm test                    # AFTER
 Test Files  5 passed (5)
      Tests  130 passed (130)
```
The extra 3 files / 100 tests are other agents' new suites (`lib/backup.security.test.ts`,
`lib/mpesa/daraja.security.test.ts`, `lib/mpesa/mpesa-routes.security.test.ts` — all untracked, not mine).
The audit baseline suite on its own still passes:

```
$ npx vitest run lib/reconcile.test.ts
 Test Files  1 passed (1)
      Tests  3 passed (3)
```

```
$ npm audit                   # BEFORE
next  16.0.0 - 16.4.0
Severity: critical
Next.js: Unauthenticated Remote Code Execution in Image Optimization API when SVG files are used - GHSA-2464-fhr4-w9xw
Next.js: Denial of Service in App Router using Server Actions - GHSA-p3m5-59mp-jv5r
Next.js: Unauthenticated Remote Code Execution in `use cache` functions returning typed arrays - GHSA-673q-mjm6-r5xr
fix available via `npm audit fix`
node_modules/next

zod  <4.6.6
Severity: high
Zod can exhaust memory while validating oversized constrained collections - GHSA-mrhx-c7xc-m3w5

2 vulnerabilities (1 high, 1 critical)

$ npm audit                   # AFTER
zod  <4.6.6
Severity: high
Zod can exhaust memory while validating oversized constrained collections - GHSA-mrhx-c7xc-m3w5
fix available via `npm audit fix --force`
Will install zod@4.6.7, which is a breaking change
node_modules/zod

1 high severity vulnerability
```
The three `next` advisories are **gone**. The remaining `zod` advisory is **out of scope** (see §7).

```
$ node -e "console.log(require('next/package.json').version)"
16.4.3

$ npm install                  # after bumping package.json to ^16.4.3
removed 2 packages, changed 4 packages, and audited 211 packages in 1m

$ corepack pnpm install --lockfile-only     # pnpm 10.34.6 (the version package.json pins)
Done in 12.9s using pnpm v10.34.6
```
> ⚠️ `NODE_ENV=production` is set in this sandbox, so the first `npm install` **pruned the dev
> dependencies** (`vitest`, `vite`, `typescript`, `tsx`) and `npm test` failed with
> `sh: 1: vitest: not found`. Re-running `NODE_ENV=development npm install --include=dev`
> restored them (268 packages). The owner should be aware that a plain `npm install` in a
> production-flagged environment strips the test tooling.

```
$ npm run build
▲ Next.js 16.4.3 (Turbopack)
✓ Running next.config.mjs took 92ms
- Experiments (use with caution):
  · optimizePackageImports
⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
✓ Compiled successfully in 63s
✓ Generating static pages using 1 worker (172/172) in 6.1s
…
exit=0
```
The build passes on 16.4.3. The `middleware` → `proxy` deprecation warning is pre-existing
(`middleware.ts` is not my file). `next.config.mjs` was parsed successfully, which also proves
the new CSP block is valid JS.

**Exact version bump:** `"next": "^16.3.8"` → `"next": "^16.4.3"` (lockfiles pin **16.4.3** exactly).

### Which advisories were still theoretically reachable before the patch?

| Advisory | Reachable in this deployment? |
|---|---|
| GHSA-2464-fhr4-w9xw (RCE, Image Optimization API + SVG) | **Reduced, not provably eliminated.** `images.unoptimized: true` means the two `<Image>` components never call `/_next/image`, but the optimizer endpoint is still part of the Next server. A patched version removes the risk regardless. |
| GHSA-673q-mjm6-r5xr (RCE, `use cache` functions) | **Not reachable.** `grep -rn '"use cache"' app lib components` returns nothing — the app uses no `use cache` directives. It becomes reachable the moment someone adds one. |
| GHSA-p3m5-59mp-jv5r (DoS, App Router Server Actions) | **Reachable.** Three files use `"use server"` (`app/(marketing)/auth/forgot-password/action.ts`, `lib/actions.ts`, `lib/actions/settings.ts`). The DoS was the one advisory that was live in this codebase. |

---

## 5. 🔐 SECURITY ROLLOUT NOTE (for the owner — do these in this order)

Making the bucket private is a **breaking change for anyone holding an old URL**. Do not skip
step 1, and do not deploy the code before the data is migrated.

**Step 0 — Deploy the code first, keep the bucket public.**
Merge/deploy this branch. The new code works with a public bucket *and* a private one:
the upload route stores the object path (not a public URL), and reads go through signed URLs.
Nothing breaks yet, and the new uploads are already stored in the new format.

**Step 1 — Migrate the rows that still hold a public URL.**
The database column `documents.file_url` (and `property_photos.file_url`) currently holds a
public URL for every pre-existing row. Convert them to the object path:

```sql
-- preview first
select id, file_url from documents
 where file_url like 'http%' limit 20;

-- documents: /storage/v1/object/public/documents/<path>  ->  <path>
update public.documents
   set file_url = split_part(file_url, '/storage/v1/object/public/documents/', 2)
 where file_url like '%/storage/v1/object/public/documents/%';

-- property photos (same shape)
update public.property_photos
   set file_url = split_part(file_url, '/storage/v1/object/public/documents/', 2)
 where file_url like '%/storage/v1/object/public/documents/%';
```
Verify afterwards that no row still contains `http`:
`select count(*) from public.documents where file_url like 'http%';` → must be `0`.
The API also tolerates a legacy URL (it converts it on the fly), so a missed row degrades to
"the API can serve it, the client-side pages cannot".

**Step 2 — Fix the client-side pages that read the table directly in the browser.**
These three pages read `documents` / `property_photos` straight from the browser Supabase
client and render `file_url` as a link/image. After step 1 that value is a **path**, not a
URL, so the link is broken until the page asks the API for a signed URL:
* `app/dashboard/documents/page.tsx` (list — "View"/"Download" buttons)
* `app/dashboard/documents/[id]/page.tsx` (detail — "View"/"Download" + inline preview)
* `app/dashboard/properties/page.tsx` (cover photo in the property list)

Fix: call `GET /api/documents` / `GET /api/documents/[id]` / `GET /api/properties/[id]/photos`
and use the `file_url` (signed URL) that comes back — the response shape is unchanged, only
the *value* of `file_url` is now a 5-minute signed URL. (This is the same work as CRYPTO-025:
converting those pages to server-side reads. I do not own them.)

**Step 3 — Flip the bucket to private.**
Run the updated `supabase-setup/01-create-tables.sql` (or just the bucket block) in the
Supabase SQL editor. It now contains `ON CONFLICT (id) DO UPDATE SET public = false`, so it
flips the existing bucket. **Existing public URLs stop working at this moment** — that is
the point, but it is the moment any external copy of a document link (an email, a WhatsApp
message, a pasted invoice) becomes a dead link. Warn support before you run it.

Verify:
```sql
select id, name, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'documents';
-- public must be false
select policyname, cmd from pg_policies where tablename = 'objects' and schemaname = 'storage';
-- 4 policies on the documents bucket, all owner-scoped
```

**Step 4 — Confirm the RPC lockdown.**
```sql
select has_function_privilege('anon','public.bump_paybill_counters(uuid,boolean)','EXECUTE');        -- f
select has_function_privilege('authenticated','public.bump_paybill_counters(uuid,boolean)','EXECUTE'); -- f
select has_function_privilege('service_role','public.bump_paybill_counters(uuid,boolean)','EXECUTE'); -- t
select has_function_privilege('anon','public.prune_old_backups()','EXECUTE');                        -- f
select has_function_privilege('service_role','public.prune_old_backups()','EXECUTE');                -- t
```
Negative test from outside (should be 401/403/404, never 200):
`curl -X POST "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/rpc/bump_paybill_counters" -H "apikey: $ANON_KEY" -H "Content-Type: application/json" -d '{"p_paybill_id":"<any-uuid>","p_matched":true}'`

**Step 5 — Rotate the M-Pesa/paybill data you care about.**
Any counter that was inflated while `anon` could call the RPC is untrustworthy: sanity-check
`paybills.matched_count` / `unmatched_count` / `last_payment_at` against `c2b_transactions`
and `reconciliation_audit` and correct them by hand.

**Step 6 — Rotate the service-role key** if it has ever been exposed in a client bundle or a
log; the new code uses it only as a signed-URL fallback and for the legacy photo cleanup.

---

## 6. The CSP that shipped

**Mode: `Content-Security-Policy-Report-Only`.** It is a *candidate enforcing* policy — it
collects violations without blocking anything, because I cannot prove it will not break the
app (Next.js injects inline bootstrap scripts; `app/layout.tsx` injects an inline JSON-LD
`<script>`; recharts and the theme provider set inline styles; the browser talks to Supabase
directly). A CSP that breaks the site is worse than no CSP.

**Exact header value shipped** (`next.config.mjs`, applied to `source: "/(.*)"`):

```
Content-Security-Policy-Report-Only: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com https://*.tile.openstreetmap.org; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-src 'self'; worker-src 'self' blob:; media-src 'self' blob:; manifest-src 'self'; upgrade-insecure-requests
```

Host rationale: `*.supabase.co` = Supabase REST/Auth/Realtime **and** Storage objects;
`images.unsplash.com` = marketing hero images; `*.tile.openstreetmap.org` = react-leaflet tiles.
`script-src`/`style-src` keep `'unsafe-inline'` because there is no nonce yet.

**HSTS is fully enforced (this is not report-only):**

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```
⚠️ `includeSubDomains` is a commitment: every subdomain of the apex domain must be HTTPS-only
or browsers will refuse to load it after the first visit. `preload` additionally requires
submitting the domain to hstspreload.org (needs ≥ 1 year max-age — we have 2 years — and the
domain must serve HTTPS on all subdomains).

**What to test before switching to enforcing mode**

1. Deploy with the report-only header (this branch) and walk **every** page type with the
   browser console open: marketing home, pricing, auth sign-in/sign-up, forgot-password,
   dashboard overview, tenants (list + detail), properties (list + detail + map), documents
   (list + detail + upload), payments/paybill, charts (recharts), the property map (leaflet
   tiles), and the theme switcher (dark mode). Chrome and Firefox both log report-only
   violations to the console.
2. Fix every violation. Expected, already accounted for: the inline JSON-LD script in
   `app/layout.tsx`, Next's own inline bootstrap scripts, and inline styles from recharts.
3. **Add a per-request nonce** — this is the blocker for dropping `'unsafe-inline'`:
   in `middleware.ts` generate a nonce, put it in the `Content-Security-Policy` **request**
   header and forward it as the `x-nonce` request header; Next.js then stamps its own inline
   scripts with it. Then the directive becomes
   `script-src 'self' 'nonce-<per-request>'` (and `'strict-dynamic'` if you want to keep
   `script-src-elem` tight).
4. If `NEXT_PUBLIC_SUPABASE_URL` is **not** a `*.supabase.co` host (self-hosted Supabase or a
   custom domain), add that host to `connect-src` and `img-src` first — otherwise the app will
   not talk to its own database.
5. Optionally add a reporting endpoint and append `report-uri /api/csp-report` (or
   `report-to csp-endpoint`) so violations are collected server-side instead of only in the
   console. There is no such endpoint today — the header therefore only produces console
   output.
6. When the console is clean, rename the header key in `next.config.mjs` from
   `Content-Security-Policy-Report-Only` to `Content-Security-Policy` and redeploy.

---

## 7. Left PARTIAL / WONT_FIX — and exactly what is needed

1. **INFRA-014 — `Content-Disposition: attachment` + `nosniff` on document downloads.**
   Not implemented. A signed URL points at the Supabase origin, so the app cannot set response
   headers on it; forcing `Content-Disposition` requires either (a) the `download` option on
   `createSignedUrl(path, 300, { download: "name.pdf" })` — one line per route, but the
   "View" button then downloads instead of displaying, and inline `<img>` previews of image
   documents are affected; or (b) a **proxy route** that streams the object with the right
   headers (`Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`,
   `Content-Type` from our own allowlist). Option (b) needs a new file
   (`app/api/documents/[id]/download/route.ts`) that I was not allowed to create. Mitigation
   shipped instead: strict content-type + extension allowlist, magic-byte verification, no
   HTML/SVG allowed, `text/plain` markup rejected, and a 5-minute URL lifetime.
2. **INFRA-015 — re-encode images with `sharp`.** Not implemented: `sharp` is not a
   dependency and adding it is a dependency + build change beyond my file list. The
   magic-byte sniff closes the "any bytes accepted as image/png" hole; what remains is that
   a valid-but-hostile image (e.g. a decompression bomb) is stored as-is. The 8 MB upload cap
   limits the blast radius.
3. **A dedicated `property-photos` bucket.** Not implemented on purpose (§3.2). To do it
   later: create the bucket private, copy every `property-photos/{userId}/…` object into it
   with the path rewritten to `{userId}/…`, update the row, then point the route at the new
   bucket. Needs a migration script and a bucket that exists in the live project.
4. **The `zod` high-severity advisory (GHSA-mrhx-c7xc-m3w5, `zod < 4.6.6`).** Out of scope
   for this track (it is not one of my findings) and the automated fix is a **breaking major
   upgrade** to `zod@4.6.7` that touches every schema in the app. Exact command when you
   decide to do it: `npm audit fix --force` (or `pnpm update zod@^4.6.7`) — then fix the
   resulting type errors; the app pins `zod: 3.25.76`.
5. **`INFRA-011` remainder** — `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`,
   `X-XSS-Protection: 0`, and a fuller `Permissions-Policy` (`payment`, `usb`,
   `accelerometer`, `gyroscope`, `interest-cohort`) were **not** added. COOP in particular can
   break the OAuth popup flow. Not my finding; left for the owner.
6. **`INFRA-012` (rate limiting) / `INFRA-015` (sharp) / `CRYPTO-014` (backup bucket
   policies)** — not mine, not touched.
7. **The `documents`/`property_photos` bucket has no policy for the `backups` bucket** — the
   `backups` bucket still has **no** storage policies at all (CRYPTO-014). Out of scope, but
   the owner should know the backup bucket is still an open question.
8. **SQL was never executed** — the sandbox has no Postgres. The scripts are additive, but
   please run them in a staging Supabase project first and check §5 step 4 for the expected
   `false`/`true` privilege results.

---

## 8. Files I did **not** touch (and had to work around)

* `lib/storage.ts` — the signed-URL helper was duplicated into the four routes instead.
* `components/document-upload-form.tsx`, `components/property-photo-gallery.tsx`,
  `app/dashboard/documents/**`, `app/dashboard/properties/page.tsx` — the UI keeps working
  **unchanged** (same field names, same shapes); the only visible change is that
  `file_url` is now a signed URL instead of a permanent public URL. The pages that read the
  table directly from the browser are listed in §5 step 2.
* `middleware.ts` — needed for the CSP nonce (§6 step 3).
* `lib/backup.ts`, `lib/mpesa/**`, `app/api/mpesa/**`, `lib/api/**`, `app/api/backup/**`,
  `app/api/tenants/**`, `app/api/payments/**`, `db/migrations/**`, `lib/crypto/**` — owned by
  other tracks, untouched.
