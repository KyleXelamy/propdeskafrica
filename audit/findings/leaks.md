# PropDesk Africa — Leak Audit (secrets, PII, placeholder/mock data)

**Task:** `audit-leaks` · **Repo:** `/workspace/propdesk` · **Baseline commit:** `467c500` · **Mode:** read-only (no application source was modified)

**Result:** 25 findings — **1 CRITICAL, 8 HIGH, 13 MEDIUM, 3 LOW**.

---

## Executive summary

The **secret-hygiene half of this codebase is genuinely good**. There is no `.env` file, no `.env.example`, no hardcoded API key, service-role key, Stripe key, M-Pesa credential, Neon/Postgres connection string, JWT or private key anywhere in the tree — including `scripts/`, `db/`, `supabase/`, `supabase-setup/`, `public/`, `.v0-assets/`, the SQL/DOCX/CSV assets, `package-lock.json`, `pnpm-lock.yaml` and `next.config.mjs`. I swept for ~25 live-credential patterns and for base64/JWT-shaped blobs; every hit was a package-lock integrity hash. **No credential is `NEXT_PUBLIC_`**. The only browser-exposed values are the Supabase project URL, the Supabase **anon** key (public by design — RLS is enabled on every table the app queries), and the app URL / git commit SHA.

The leaks are elsewhere:

1. **One CRITICAL data-exposure path** — the Supabase Storage `documents` bucket is created with `public = true`, and every landlord/tenant document (KYC, leases, receipts) is uploaded there and served from a **public URL** (`LEAK-002`).
2. **Real personal/business PII committed to `public/`** and linked as a download inside the dashboard (`LEAK-001`).
3. **PII in server logs** across 9 endpoints, **PII over-broad in list/export responses**, and **41 sites** that return raw database error text to the client (`LEAK-004` … `LEAK-012`).
4. **A large mock/fabrication surface that will ship**: 9 write endpoints that only `console.log` and return a fake success reference, two endpoints that return hardcoded rows, an "Airtel Money" payment method with no integration, a promised audit log and rate limiter that do not exist, a promised data-residency feature that does not exist, and fabricated customer case studies with attributable quotes (`LEAK-013` … `LEAK-025`).

**Launch blockers:** `LEAK-002` (CRITICAL), `LEAK-001`, `LEAK-014`, `LEAK-017`.

---

# Scope A — Secrets and credentials

## A.1 Hardcoded credentials — **CLEAN**

Searched the whole tree (excluding `node_modules/`, `.git/`, `.next/`) for: hardcoded API keys, tokens, passwords, connection strings, private keys, Supabase service-role / anon keys, JWTs, Neon & Postgres URLs, Stripe `sk_/rk_/whsec_` keys, M-Pesa passkey / consumer secret / consumer key / business shortcode / security credential, AWS `AKIA`/`ASIA`, GitHub `ghp_`/`gho_`/`github_pat_`, GitLab `glpat-`, Slack `xox*`, Google `AIza`, SendGrid `SG.`, Square `sq0*`, `-----BEGIN … PRIVATE KEY-----`, and base64/JWT-shaped blobs ≥24 chars.

**Result: zero hits.** The `eyJ…` matches in `package-lock.json:4407` and `pnpm-lock.yaml:1962` are `sha512-` integrity hashes. `package-lock.json` and `pnpm-lock.yaml` contain no registry auth tokens (`_authToken` / `npmAuthToken` absent) and no non-npmjs resolved hosts. `.v0-assets/favicon_io.zip` contains only 7 PNG/ICO icon files (`unzip -l`), no data export. There is **no** `public/backups/`, `*.dump`, `*.sql.gz` or DB-dump file in the tree.

## A.2 Environment variables read by the code

30 distinct variables are read. Classification:

| Variable | Read at | Exposure | Verdict |
|---|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase/service.ts:17`, `app/api/mpesa/callback/route.ts:63`, `app/api/mpesa/c2b/confirmation/route.ts`, `app/api/stripe/webhook/route.ts:19`, `app/api/subscription/{checkout,checkout-status,stripe-checkout}/route.ts`, `app/api/properties/[id]/photos/route.ts:60`, `lib/storage.ts` | **server only** | OK — never `NEXT_PUBLIC_`, never sent to a client, never logged |
| `DATABASE_URL` / `POSTGRES_URL` / `POSTGRES_PRISMA_URL` | `lib/db/neon.ts:26`, `lib/db/migrate.ts:31` | server only | OK |
| `STRIPE_SECRET_KEY` | `lib/stripe.ts:7` | server only | OK |
| `STRIPE_WEBHOOK_SECRET` | `app/api/stripe/webhook/route.ts:7` | server only | OK |
| `MPESA_CONSUMER_KEY` / `MPESA_CONSUMER_SECRET` / `MPESA_PASSKEY` / `MPESA_SHORTCODE` / `MPESA_SECURITY_CREDENTIAL` / `MPESA_INITIATOR_NAME` | `lib/mpesa/daraja.ts:51-54, 225-226, 503-504` | server only | OK — sent only to `api.safaricom.co.ke`; the derived STK `Password` is never logged or returned |
| `MPESA_CALLBACK_SECRET` | `app/api/mpesa/callback/route.ts:29` | server only | OK — compared with `timingSafeEqual` (`route.ts:34`) |
| `CRON_SECRET` / `BACKUP_CRON_SECRET` / `MIGRATION_SECRET` | `app/api/cron/run/route.ts:22`, `app/api/backup/auto/route.ts:27`, `app/api/migrations/{run,reset,rollback}/route.ts` | server only | OK (non-constant-time compare is the **infra** track's finding, not a leak) |
| `MPESA_ALLOWED_CALLBACK_IPS`, `MPESA_ENV`, `MPESA_SANDBOX_MOCK`, `MPESA_CALLBACK_URL` | `lib/mpesa/daraja.ts:47,56,269`, `app/api/mpesa/stkpush/route.ts:44` | server only | OK |
| `NOMINATIM_EMAIL` | `app/api/properties/[id]/geocode/route.ts:41` | server only | OK |
| `NEXT_PUBLIC_SUPABASE_URL` | 18 sites | **browser** | Public by design (project URL, not a secret) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 7 sites | **browser** | Public by design. Verified: RLS is enabled on **every** table the app touches — `properties, tenants, rent_payments, expenses, maintenance_requests, documents, notes, user_profiles, notifications, property_photos, tenant_users, mpesa_transactions, paybills, c2b_transactions, companies, managed_landlords, team_members, quotations, damages, contacts, reconciliation_rules, reconciliation_audit, system_version, patches, backups, backup_runs, restore_runs, plans, subscriptions, subscription_events, subscription_payments, payment_test_attempts, billing_webhook_events, paybill_properties`. The one table without RLS, `public.app_users` (`db/migrations/001-core.sql:24`, holds `email`/`full_name`), lives in the Neon schema and is **never queried** by the app. |
| `NEXT_PUBLIC_APP_URL` | `app/api/subscription/stripe-checkout/route.ts:17` | browser-inlinable | Not a secret |
| `NEXT_PUBLIC_APP_COMMIT` | `lib/system.ts:59` | **browser** | Not a secret — a git SHA. `next.config.mjs:41` also inlines `VERCEL_GIT_COMMIT_SHA` into the client bundle as `APP_COMMIT`. Low sensitivity, listed for completeness. |
| `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` | `lib/actions.ts:74`, `app/(marketing)/auth/forgot-password/action.ts:10` | browser-inlinable | Not a secret — an OAuth redirect URL. |
| `VERCEL_URL`, `VERCEL_GIT_COMMIT_SHA`, `NODE_ENV` | various | server / build | Not secrets |

**No client component (`"use client"`) reads `process.env` directly** — verified by scanning every `"use client"` file in `app/` and `components/`. **No secret is logged, echoed in an API response, or sent to the client** — the service-role key, Stripe secret and M-Pesa credentials never leave the server.

**No `.env.example` / `.env.sample` exists, and `.gitignore:20` (`.env*`) makes it impossible to add one** — see `LEAK-003`.

---

## LEAK-001 — HIGH — Real personal & business PII committed to `public/` and served unauthenticated

- **Category:** `public-asset-leak`
- **File:** `public/backup-replication-fixture.json:8-15` (tracked in git; linked from `components/backup-manager.tsx:228`)

**Evidence**

```json
public/backup-replication-fixture.json:8
  "user_profiles": [{ "id": "workspace", "full_name": "Brian Kiarie Ngugi", "company_name": "RayElite Ltd", "phone": "0758034649", "city": "Kerugoya", "county": "Kirinyaga", "address": "773-10300", "currency": "KES", "timezone": "Africa/Nairobi" }],
public/backup-replication-fixture.json:9
  "properties": [{ "id": "fixture-property-001", "name": "RayElite Court", "address": "773-10300", "city": "Kerugoya", "county": "Kirinyaga", ...
public/backup-replication-fixture.json:10
  "tenants": [{ "id": "fixture-tenant-001", "full_name": "Amina Wanjiku", "phone": "0712345678", ... }, { "id": "fixture-tenant-002", "full_name": "Peter Mwangi", "phone": "0723456789", ...
public/backup-replication-fixture.json:15
  "contacts": [{ "id": "fixture-contact-001", "name": "Kiptoo Electricals", "phone": "0700112233", "category": "vendor" }],
```

and the dashboard link that hands it to every logged-in user:

```tsx
components/backup-manager.tsx:228
  <a href="/backup-replication-fixture.json" download="backup-replication-fixture.json" ...>Download test backup file</a>
```

**Impact** — `public/` is served by Next.js with **no authentication**: `GET https://<host>/backup-replication-fixture.json` returns the file to any anonymous visitor or scraper, and it is indexed by search engines. It contains the founder's full legal name, business name, mobile number, street address, town and county (`RayElite Ltd`, `773-10300`, `Kerugoya`, `Kirinyaga`, `0758034649` — the same number published as the support line in `lib/brand.ts:6`), plus two tenant names with mobile numbers and a vendor name with a mobile number. The file is *named* like a test fixture and is *linked* as "Download test backup file", so nobody realises it carries live-looking personal data. It also primes a restore path (`POST /api/backup/import`) with someone else's rows.

> Severity note: the two tenant rows use sequential dummy numbers (`0712345678`, `0723456789`) and look synthetic; the `user_profiles`/`properties` rows carry the operator's real identity, address and phone. I rated this **HIGH** rather than CRITICAL for that reason — the file is a public, unauthenticated exposure of real personal data regardless.

**Fix**
1. `git rm --cached public/backup-replication-fixture.json`, replace with a genuinely empty template (`{"schema_version":11,"app_version":"fixture","generated_at":"","user":{"id":"workspace"},"counts":{},"data":{}}`) and regenerate the non-PII fields at request time instead of shipping a static file.
2. Move the file out of `public/` (e.g. `fixtures/backup-replication-fixture.json`) and serve it from an authenticated route, or delete the link at `components/backup-manager.tsx:228` entirely.
3. Scrub the founder's phone/address from the fixture, and rotate anything that ever lived in it.

---

## LEAK-002 — CRITICAL — `documents` Storage bucket is created `public = true`; every tenant document is served from a public URL

- **Category:** `public-asset-leak`
- **Files:** `supabase-setup/01-create-tables.sql:326-328`, `supabase-setup/02-add-missing-columns.sql:65-67`, `app/api/documents/upload/route.ts:40-55`, `app/api/properties/[id]/photos/route.ts:59-70`

**Evidence**

```sql
-- supabase-setup/01-create-tables.sql:324-328
-- 12.  STORAGE BUCKET FOR DOCUMENTS
-- =====================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;
```

```sql
-- supabase-setup/02-add-missing-columns.sql:64-67
-- documents storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;
```

```ts
// app/api/documents/upload/route.ts:40-55
  if (uploadError) {
    return errorResponse(
      `Storage upload failed: ${uploadError.message}. ` +
        `Make sure the 'documents' bucket exists in Supabase Storage and is public.`,
      500,
    )
  }
  const { data: pub } = supabase.storage.from("documents").getPublicUrl(path)
  return successResponse({
    file_url: pub.publicUrl,
    ...
  }, 201)
```

**Impact** — the `documents` bucket holds **tenant documents**: national-ID / KYC scans, signed leases, receipts, damage photos and property photos (`app/api/documents/route.ts:4-18` accepts `tenant_id` and `document_type`; the dashboard's tenant record is explicitly advertised as storing "Contact, ID and KYC document storage" — `lib/content/marketing.ts:63`). Because the bucket is `public = true`, the `storage.objects` RLS policies created a few lines later (`01-create-tables.sql:336-348`, `02-add-missing-columns.sql:69-86`) are **bypassed for reads** — a public bucket serves objects to anyone who has the URL. The URL is returned by the API, stored in the `documents` table (`file_url`), rendered as a direct link in the UI (`app/dashboard/documents/page.tsx:102,108`, `app/dashboard/documents/[id]/page.tsx:96,102,145`) and included in the CSV/JSON export (`app/api/export/route.ts:27`). A single leaked or guessed URL therefore discloses a tenant's identity document to the open internet. This is the classic "real customer PII exposed" case, and the upload route's own error message tells the operator to make the bucket public.

**Fix**
1. Set the bucket private: `UPDATE storage.buckets SET public = false WHERE id = 'documents';` and change the migration files to `VALUES ('documents', 'documents', false)` — add a new numbered patch (`supabase-setup/21-private-documents-bucket.sql`) rather than editing an already-applied migration, and register it in `PATCH_LOG` (`lib/system.ts:79`).
2. Stop returning `getPublicUrl()`. Return the storage **path**, and serve downloads through an authenticated route that calls `supabase.storage.from("documents").createSignedUrl(path, 600)` — `lib/storage.ts:59-68` already implements exactly this for the `backups` bucket.
3. Migrate already-uploaded objects: re-upload each `documents.file_url` object into the private bucket and rewrite the column to the path form.
4. Rotate/revoke any document URL that has already been shared. Audit the Supabase access log for `storage/object/public/documents/*` requests that did not come from the app.

---

## LEAK-003 — MEDIUM — `.gitignore` gaps: no env template can be committed, and DB dumps / public backups are not excluded

- **Category:** `gitignore-gap`
- **Files:** `.gitignore:19-20, 25-27`, `lib/storage.ts:9-10`

**Evidence**

```
.gitignore:19  # env files
.gitignore:20  .env*
```

```
lib/storage.ts:9-10
 * If Supabase Storage isn't configured, we fall back to a public
 * edge-cached file under /public/backups (dev mode only).
```

**Impact** — `.env*` is a correct and effective block for `.env`, `.env.local`, `.env.production` (verified with `git check-ignore`), but the glob also swallows `.env.example` / `.env.sample`, so the repo has **no way to publish an env template**: 30 variables are read by the app (`lib/db/neon.ts:26`, `lib/mpesa/daraja.ts:51-56`, `lib/stripe.ts:7`, `lib/supabase/service.ts:17`, `lib/api/with-db-auth.ts:30`, `app/api/cron/run/route.ts:22`, `app/api/backup/auto/route.ts:27`, `app/api/mpesa/callback/route.ts:29`, `app/api/stripe/webhook/route.ts:7`, `app/api/geocode`/`app/api/properties/[id]/geocode/route.ts:41`, …) and **none of them is documented anywhere in the repo** (there is no README). A first deploy will fail on an undocumented variable set. There is also no exclusion for `*.dump`, `*.sql.gz`, `*.backup` or `public/backups/`, while `lib/storage.ts:9-10` documents a dev fallback that writes backup payloads under `/public/backups` — a directory that would be committed *and* served publicly. The `*.tsbuildinfo` rule (`.gitignore:26`) is correct and `tsconfig.tsbuildinfo` is correctly untracked.

**Fix**

```
# env files — keep the block, but allow the template
.env*
!.env.example

# database dumps / exports that must never be committed
*.dump
*.backup
*.sql.gz
/backups/
/public/backups/
/public/*.json.bak
```

Add a committed `env.example` listing all 30 variables with placeholder values (`SUPABASE_SERVICE_ROLE_KEY=your-service-role-key`) and mark each as server-only or `NEXT_PUBLIC_`, plus a "required in production" flag. Also add `public/backups/` to the ignore list now, before the `lib/storage.ts` fallback is ever exercised.

---

# Scope B — Data leaks in responses and logs

## LEAK-004 — HIGH — Nine endpoints `console.log` raw PII (emails, names, free-text bodies)

- **Category:** `pii-in-logs`
- **Files:** `app/api/newsletter/route.ts:25`, `app/api/feedback/route.ts:25`, `app/api/pricing/lead/route.ts:30`, `app/api/enterprise/lead/route.ts:28`, `app/api/contact/route.ts:42-46`, `app/api/customer-requests/route.ts:61`, `app/api/support/route.ts:50`, `app/api/damages/route.ts:53`, `app/api/quotations/route.ts:47`

**Evidence**

```ts
// app/api/newsletter/route.ts:25
    console.info("[newsletter] subscribe", parsed.data)          // { email, source }

// app/api/pricing/lead/route.ts:30
    console.info("[pricing/lead] new lead", parsed.data)          // { name, email, company, portfolio_size, notes }

// app/api/enterprise/lead/route.ts:28
    console.info("[enterprise/lead] new lead", parsed.data)        // { name, email, company, units, region, timeline, notes }

// app/api/feedback/route.ts:25
    console.info("[feedback] new idea", { ref, ...parsed.data })  // { title, body, email }

// app/api/customer-requests/route.ts:61
    console.info("[customer-requests] new idea", { ref, ...parsed.data })  // { title, body, email }

// app/api/contact/route.ts:42-46
    console.info("[contact] new message", {
      email: payload.email,
      topic: payload.topic,
      name: `${payload.first_name} ${payload.last_name}`,
    })

// app/api/support/route.ts:50
  console.info("[support] new ticket", { userId, ticketRef, ...parsed.data })  // full ticket body

// app/api/damages/route.ts:53
  console.info("[damages] new record", { userId, ref, ...parsed.data })

// app/api/quotations/route.ts:47
  console.info("[quotations] new request", { userId, ref, ...parsed.data })
```

**Impact** — on Vercel (the deployment target — `VERCEL_URL`/`VERCEL_GIT_COMMIT_SHA` in `next.config.mjs:41` and `lib/actions.ts:74`) `console.info` goes to stdout, which is captured into the platform's log store with the platform's retention and access model — not the app's. That means (a) the email addresses and free-text bodies of every anonymous visitor who fills in the contact / newsletter / feedback / sales-lead / support forms, and the identities of tenants captured in damage and quotation records, are written to a third-party log system; (b) six of these nine routes are **public and unauthenticated**, so an anonymous caller controls what is written to the log; (c) the free-text `message` / `notes` / `body` fields are unbounded user content written verbatim. Six of the nine (`newsletter`, `feedback`, `pricing/lead`, `enterprise/lead`, `contact`, `customer-requests`) also persist nothing — see `LEAK-014` — so the log is the *only* place that data lands, meaning it is simultaneously the only copy and an uncontrolled copy.

**Fix**
- Replace body-level logging with a structured, redacted summary: log a request id, the kind of submission, and non-identifying fields only. E.g. `console.info("[pricing/lead] new lead", { kind: "pricing_lead", portfolio_size, hasCompany: Boolean(company) })` — never `email`, `name`, `message`, `notes` or `body`.
- Introduce a tiny `logPII`-safe helper in `lib/` and route every `console.info` in `app/api/**` through it, so a future contributor cannot regress.
- If the submissions are genuinely needed, persist them to a table (they are currently lost) and delete the console path; if they are not needed yet (see `LEAK-014`), remove the logging entirely rather than logging to a platform sink.
- Note for the infra track: this is also a log-injection surface — `parsed.data` is interpolated as a structured object, but `notes`/`message` are attacker-controlled strings, so a terminal-injection / log-forging payload lands in the log stream verbatim.

---

## LEAK-005 — HIGH — Unscoped Daraja lookup returns the payer's MSISDN and full name

- **Category:** `pii-in-response`
- **Files:** `app/api/mpesa/c2b/status/[transId]/route.ts:36-41`, `lib/mpesa/daraja.ts:466-492`

**Evidence**

```ts
// app/api/mpesa/c2b/status/[transId]/route.ts:36-41
  // Otherwise, ask Daraja
  try {
    const status = await c2bTransactionStatus(transId)
    return NextResponse.json({ cached: false, daraja: status })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Status query failed"
    return NextResponse.json({ error: message }, { status: 502 })
  }
```

```ts
// lib/mpesa/daraja.ts:466-477
export interface C2BStatusResponse {
  ResponseCode?: string
  ResponseDescription?: string
  TransactionReceipt?: string
  TransactionStatus?: string
  Amount?: number | string
  TransactionDate?: string
  MSISDN?: string
  FirstName?: string
  MiddleName?: string
  LastName?: string
}

// lib/mpesa/daraja.ts:481-492  (mock branch)
    return {
      ResponseCode: "0",
      ResponseDescription: "Success (mocked)",
      TransactionReceipt: transId,
      TransactionStatus: "Completed",
      Amount: 25000,
      TransactionDate: darajaTimestamp(),
      MSISDN: "254712345678",
      FirstName: "Jane",
      LastName: "Doe",
    }
```

**Impact** — the Neon cache branch of this route correctly scopes by `user_id` (`route.ts:18-23`), but the **fallback branch has no ownership check at all**: any authenticated user who supplies an arbitrary `transId` causes the server to query Daraja for that transaction and return the whole payload — including the **payer's mobile number (`MSISDN`) and their first/middle/last name**. M-Pesa `TransID`s are short, partially sequential strings (`LKN…`, `WLK…`), so they are enumerable in the same way as an order id. The result is a cross-tenant disclosure of an end customer's phone number and legal name to an unrelated landlord. The mock branch (enabled by `MPESA_SANDBOX_MOCK=1`, `lib/mpesa/daraja.ts:56`) returns a hardcoded "Jane Doe / 254712345678", so a production deployment that leaves the mock flag on returns that literal to any caller.

**Fix**
- Scope the Daraja query to the caller: resolve `transId` → `c2b_transactions` → `paybill_id` → `paybills.user_id` **first**, and 404 if it does not belong to the caller, before ever calling Daraja. Keep the existing Neon query but run it unconditionally (not only as a cache lookup).
- If a Daraja lookup is genuinely needed, request only the fields the UI shows (`TransactionStatus`, `Amount`, `TransactionDate`, `TransactionReceipt`) and drop `MSISDN` / `FirstName` / `MiddleName` / `LastName` from the response object before returning it.
- Never return the upstream payload verbatim — map it to an explicit allow-list DTO.
- Guard the mock branch: refuse to run when `NODE_ENV === "production"`, and make the mock return obviously-fake values (`MSISDN: "0000000000"`) rather than a plausible Kenyan number.

---

## LEAK-006 — MEDIUM — Tenant list endpoint returns national ID, emergency contact and free-text notes for every row

- **Category:** `pii-in-response`
- **Files:** `app/api/tenants/route.ts:29-40`, `app/api/tenants/[id]/route.ts:26,72`, `app/api/payments/route.ts:28,80`

**Evidence**

```ts
// app/api/tenants/route.ts:29-33
  let query = supabase
    .from("tenants")
    .select("*, properties(name, address)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
```

**Impact** — `select("*")` on `tenants` returns every column, including `national_id` (the Kenyan national ID number, written at `route.ts:65`), `id_number`, `email`, `phone`, `emergency_contact_name`, `emergency_contact_phone` and the free-text `notes` field — for the **entire tenant list**, not just the record the caller opened. The list view needs only name, property and status. Every one of those rows is then rendered client-side, cached in the browser, and reachable from the exported JSON/CSV (see `LEAK-007`), which widens the blast radius of any XSS or device compromise from "one tenant record" to "every tenant's ID numbers". `app/api/payments/route.ts:28` compounds it by joining `tenants(full_name, email)` into **every payment row**, so a payments table of 500 rows carries 500 tenant email addresses.

**Fix**
- Replace `select("*")` with an explicit list for the list endpoint: `select("id, full_name, first_name, last_name, property_id, status, lease_start_date, lease_end_date, monthly_rent, properties(name)")`.
- Keep the full record (including `national_id`) on the **single-tenant** endpoint only, and add a query flag (e.g. `?fields=identity`) for the rare case a user genuinely needs to copy an ID number.
- Drop `email` from the payments join (`select("*, tenants(full_name), properties(name, address)")`).
- Add a shared `TENANT_LIST_FIELDS` / `TENANT_DETAIL_FIELDS` constant next to the existing `TENANT_FIELDS` allow-list (`app/api/tenants/route.ts:4-22`) so the two stay in sync.

---

## LEAK-007 — MEDIUM — Export / backup include national ID and emergency contacts; the redaction list only covers secrets

- **Category:** `pii-in-response`
- **Files:** `app/api/export/route.ts:20-29`, `lib/backup.ts:23-37`, `lib/system.ts:132-152`

**Evidence**

```ts
// app/api/export/route.ts:21-23
    supabase.from("properties").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("tenants").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("rent_payments").select("*").eq("user_id", userId).order("payment_date"),
```

```ts
// lib/system.ts:132-152
const NEVER_BACKUP = new Set([
  "password", "password_hash", "token", "encrypted_password", "session_token",
  "refresh_token", "secret", "api_key", "private_key", "access_token",
])

export function sanitiseRow(row: Record<string, unknown>): SanitisedRow {
  const out: SanitisedRow = {}
  for (const [k, v] of Object.entries(row)) {
    if (NEVER_BACKUP.has(k.toLowerCase())) continue
    out[k] = v
  }
  return out
}
```

**Impact** — the export and backup paths are *designed* to be a complete copy of the workspace, so `national_id`, `email`, `phone`, `emergency_contact_name`, `emergency_contact_phone` and `notes` all flow into a downloadable file (and into the `backups` table payload, `lib/backup.ts:281-308`). The `NEVER_BACKUP` allow-list is a **deny-list of secret-shaped column names** — it protects against leaking credentials but does nothing for identity documents, so the redaction story is inconsistent: the product's own privacy page (`app/(marketing)/legal/privacy/page.tsx:67-70`) promises "You can export, correct or delete your data at any time from Settings → Data", and the resulting file is a plaintext dump of every tenant's national ID number, sitting in the user's Downloads folder and (for the >5 MB path) in a Supabase Storage bucket that `lib/storage.ts:31-56` writes to under a service-role client.

**Fix**
- Extend the redaction policy with an explicit, *configurable* PII column set: `national_id`, `id_number`, `emergency_contact_phone`, and (behind a flag) `email`/`phone`. Keep a documented "include identity data" opt-in for the legitimate use case (moving a portfolio between accounts).
- Document the residual risk in the export UI ("This file contains identity document numbers — store it securely") and stamp the file with the user id and a generation timestamp so a leaked export is attributable.
- Add `Content-Disposition: attachment` + `Cache-Control: no-store` (already present) and ensure the `backups` Storage bucket is **private** (see `LEAK-002` fix — same bucket-creation helper should be reused).

---

## LEAK-008 — MEDIUM — Document list returns the public `file_url` and free-text notes

- **Category:** `pii-in-response`
- **Files:** `app/api/documents/route.ts:26-38`, `app/api/export/route.ts:27`

**Evidence**

```ts
// app/api/documents/route.ts:26-30
  let query = supabase
    .from("documents")
    .select("*, properties(name, address), tenants(full_name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
```

**Impact** — the documents listing returns `file_url` for every document — i.e. the **public** Supabase Storage URL of a tenant's national-ID scan or signed lease (`LEAK-002`). A list endpoint is the wrong place to hand out direct object URLs: one `curl` of the list (or one XSS in the dashboard) yields a shareable, unauthenticated link to every KYC document in the portfolio. `select("*")` also pulls the `notes` free-text field, which is where landlords write things like "ID pending — original seen in person, copy of passport page 2".

**Fix**
- Stop returning `file_url` in list responses. Return the storage **path** plus metadata, and mint a short-lived signed URL (`lib/storage.ts:59-68`) only when the user opens/downloads a specific document — via `app/api/documents/[id]/route.ts`, which already resolves the row.
- Replace `select("*")` with an explicit list: `id, name, title, type, document_type, property_id, tenant_id, category, file_size, mime_type, expiry_date, reminder_days_before, created_at`.
- Drop the `notes` column from list responses; return it only on the detail endpoint.

---

## LEAK-009 — MEDIUM — `withDbAuth` returns raw exception text and discloses the DB architecture

- **Category:** `verbose-error`
- **File:** `lib/api/with-db-auth.ts:81-87, 104-108`

**Evidence**

```ts
// lib/api/with-db-auth.ts:81-87
    if (!neonConfigured()) {
      return jsonError(
        "DATABASE_URL is not configured. Add it to .env.local (Neon) " +
          "or remove withDbAuth to fall back to the Supabase path.",
        500,
      )
    }

// lib/api/with-db-auth.ts:104-108
    } catch (e: any) {
      if (e instanceof DbHttpError) return jsonError(e.message, e.status)
      console.error("[propdeskafrica] withDbAuth handler error", e)
      return jsonError(e?.message || "Internal error", 500)
    }
```

**Impact** — any unexpected failure in a `withDbAuth` route returns the **raw exception message** to the client. On the Neon path that message is the HTTP driver's own error text, which embeds the failing **SQL statement**, table names, column names, constraint names and Postgres error codes (e.g. `column "foo" of relation "tenants" does not exist`, `duplicate key value violates unique constraint "tenants_pkey"`). It also discloses the backend topology ("Neon", "the Supabase path") to any caller, and the first message tells an anonymous prober exactly which env var is missing and which file to change. Unlike `lib/api/index.ts:56-59` — which correctly gates the raw message behind `NODE_ENV === "production"` — this helper has no such gate.

**Fix**
- Mirror the `withAuth` pattern: `const message = process.env.NODE_ENV === "production" ? "Internal server error" : (e instanceof Error ? e.message : "Internal error")`.
- Return a stable error **code** (e.g. `DB_QUERY_FAILED`) plus a request id; keep the detail in the server log only.
- Change the misconfiguration message to `{"error":"Service unavailable","code":"DB_NOT_CONFIGURED"}` — never name the env var or the vendor to the client.
- Keep `DbHttpError` (which carries a deliberate, user-safe message) as the only exception allowed to reach the client verbatim.

---

## LEAK-010 — MEDIUM — 41 sites return raw database error text to the client

- **Category:** `verbose-error`
- **Files (representative):** `app/api/company/route.ts:26,55`, `app/api/paybill/route.ts:31`, `app/api/reconciliation/rules/route.ts:71,131`, `app/api/dashboard/leases/route.ts:34`, `app/api/documents/route.ts:37,75`, `app/api/documents/[id]/route.ts:63,85`, `app/api/expenses/route.ts:44,77`, `app/api/expenses/[id]/route.ts:54,66`, `app/api/maintenance/route.ts:38,72`, `app/api/maintenance/[id]/route.ts:58,70`, `app/api/notes/route.ts:30,57`, `app/api/notes/[id]/route.ts:46,58`, `app/api/payments/route.ts:50,83`, `app/api/payments/[id]/route.ts:53,65`, `app/api/profile/route.ts:12,49`, `app/api/properties/route.ts:40,83`, `app/api/properties/[id]/route.ts:75,87`, `app/api/properties/[id]/photos/route.ts:23,103,140,177`, `app/api/subscription/route.ts:57,141`, `app/api/tenants/[id]/route.ts:75,87`, `app/api/tenants/[id]/invite/route.ts:60`

**Evidence**

```ts
// app/api/tenants/route.ts:38-40
  const { data, error } = await query
  if (error) return errorResponse(error.message, 500)
  return successResponse(data)
```

```ts
// app/api/paybill/route.ts:31
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
```

**Impact** — 41 occurrences of the exact pattern `errorResponse(error.message, 500)` / `NextResponse.json({ error: error.message }, { status: 500 })` return the PostgREST / Supabase error string verbatim to the caller. That string routinely contains the **table name**, the **column name**, the **constraint name** and the Postgres error code — e.g. `null value in column "national_id" violates not-null constraint`, `duplicate key value violates unique constraint "properties_user_id_name_key"`, `permission denied for table tenants`. It is a free schema map for an attacker, it is a fingerprint of which optional tables have been installed in a given deployment, and for a handful of routes it is materially confusing to a landlord ("insert into \"tenants\" violates foreign key constraint" is not an answer a product can give its users). Note the contrast with the deliberately generic messages a few lines away in the same files (`app/api/paybill/route.ts:51-52` — "That account is already configured." / "Could not save this payment account."), which show the team already knows the right pattern.

**Fix**
- Introduce one helper in `lib/api/index.ts` — e.g. `dbErrorResponse(error, context)` — that logs the full error server-side and returns `{"error":"Something went wrong","code":"DB_ERROR"}` with a request id. Then replace all 41 call sites mechanically.
- Where the error is genuinely actionable, map it: `23505` → 409 "That already exists"; `23503` → 400 "That record is linked to something else"; `42P01` / `PGRST205` → 503 "This feature is not enabled yet" (the existing `isMissingTableError` helper at `lib/api/index.ts:100-103` already detects these).
- Add a lint rule / grep gate so `errorResponse(error.message` cannot reappear.

---

## LEAK-011 — MEDIUM — Upstream Daraja error text and raw provider payloads returned to the browser

- **Category:** `verbose-error`
- **Files:** `app/api/mpesa/stkpush/route.ts:58,60-61,76,85`, `app/api/mpesa/status/route.ts:28-29,51`, `app/api/mpesa/c2b/register/route.ts:40,45`, `app/api/mpesa/c2b/status/[transId]/route.ts:38,40-41`

**Evidence**

```ts
// app/api/mpesa/stkpush/route.ts:53-61, 76, 85
  const result = await stkPush({ ... }).catch((e) => ({ error: e.message }))
  if ((result as any).error) {
    return errorResponse((result as any).error, 502)
  }
  ...
    raw_response: result,          // whole Daraja payload persisted
  ...
  if (insErr) {
    // Degrade: still surface the Daraja response so the UI can show the prompt.
    return successResponse({ ...tx, db_error: insErr.message, _id: null })
  }
```

```ts
// lib/mpesa/daraja.ts:184-186
  if (!res.ok) {
    throw new Error(`STK push failed: ${res.status} ${JSON.stringify(json)}`)
  }
```

**Impact** — `stkPush`/`stkQuery`/`c2bRegister` throw errors that embed the **HTTP status and the full upstream JSON body** from Safaricom (`lib/mpesa/daraja.ts:84, 186, 241, 386, 518`). That text is piped straight back to the browser by `app/api/mpesa/stkpush/route.ts:61` and `app/api/mpesa/status/route.ts:29`, and by `app/api/mpesa/c2b/register/route.ts:45` / `app/api/mpesa/c2b/status/[transId]/route.ts:41`. The Daraja error body can include the shortcode, the consumer's account identifiers and internal upstream codes. Separately, `app/api/mpesa/stkpush/route.ts:85` returns a **200 OK** whose body carries `db_error: insErr.message` — a raw DB error smuggled inside a success response, where client code (and monitoring) will not treat it as an error. `raw_response: result` (`:76`) stores the whole provider payload — which for a status query includes the payer's `MSISDN` and name (`lib/mpesa/daraja.ts:466-477`) — in the `mpesa_transactions` table and returns it to the browser (`:85`, and `app/api/mpesa/status/route.ts:49,51`).

**Fix**
- Wrap the Daraja calls so that upstream failures become a stable, user-safe message: `errorResponse("The payment request could not be completed. Please try again.", 502)`, and log the upstream detail server-side with the request id.
- Return `db_error` as `null`/omit it, and return a **non-2xx** status when the DB write fails — a degraded 200 hides real failures from monitoring and from the user.
- Do not persist or return `raw_response` verbatim; whitelist the fields the UI needs (`ResponseCode`, `ResponseDescription`, `CustomerMessage`, `CheckoutRequestID`) and drop `MSISDN`/`FirstName`/`LastName`.
- Add a `darajaSafeError()` helper in `lib/mpesa/daraja.ts` so no call site can leak an upstream body by accident.

---

## LEAK-012 — MEDIUM — SQL error text rendered in the dashboard UI

- **Category:** `verbose-error`
- **Files:** `app/api/cron/run/route.ts:44`, `app/api/templates/[id]/docx/route.ts:35`, `components/system-info.tsx:75,94,101,160`

**Evidence**

```ts
// app/api/cron/run/route.ts:43-45
    } catch (e: any) {
      return errorResponse(`Migration failed: ${e?.message || e}`, 500)
    }
```

```ts
// app/api/templates/[id]/docx/route.ts:34-36
  } catch (e: any) {
    return errorResponse(e?.message || "Render failed", 500)
  }
```

```tsx
// components/system-info.tsx:101
      const firstFailure = failedResults[0]?.error
// components/system-info.tsx:160
                {ping.db_error ? ` • ${ping.db_error}` : ""}
```

**Impact** — the migration runner returns the failing SQL error to the client (`app/api/cron/run/route.ts:44`), and the patch results array — one entry per patch, each with a raw `error` string from `app/api/migrations/run/route.ts:101-104` — is rendered straight into the dashboard by `components/system-info.tsx:75,101`. A landlord with a half-migrated database therefore sees raw Postgres diagnostics (schema names, column names, `relation … does not exist`, permission errors) rendered in the product UI, and can read them from the network tab. It also tells them which internal migrations have run.

**Fix**
- Return `{"error":"Migration failed","code":"MIGRATION_FAILED","patchId":"<id>"}` and log the SQL detail server-side.
- In `components/system-info.tsx`, render a sanitised message (`"Patch p_2024_05_001 failed — see server logs"`) and keep the raw text out of the DOM.
- The same applies to `app/api/templates/[id]/docx/route.ts:35` — return "Could not generate the document" and log the cause.

---

# Scope C — Placeholder / mock / demo data that will ship

## LEAK-013 — HIGH — Fabricated customer case studies with attributable quotes, publicly rendered and API-exposed

- **Category:** `shipped-sample-data`
- **Files:** `lib/content/marketing.ts:736-800`, `app/(marketing)/customers/[slug]/page.tsx:8-10, 37-95`, `app/api/customers/[slug]/route.ts:6-14`

**Evidence**

```ts
// lib/content/marketing.ts:736-760
export const customers: Customer[] = [
  {
    slug: "highland-estates",
    name: "Highland Estates",
    industry: "Multi-family residential",
    units: "212 units",
    location: "Eldoret, Kenya",
    ...
      { label: "First-year ROI", value: "5.4×" },
      { label: "Tenant NPS", value: "+24", detail: "Year over year" },
    ],
    quote:
      "PropDesk Africa is the first tool that made reporting something I look forward to sharing with my investors.",
    quoteAuthor: "Wanjiru M., Operations Director",
```

```ts
// lib/content/marketing.ts:781-797
    slug: "kibera-housing-co",
    name: "Kibera Housing Co-op",
    ...
      { label: "Annual savings", value: "KES 1.2M" },
    ...
    quoteAuthor: "Fatma A., Co-op Secretary",
```

```ts
// app/api/customers/[slug]/route.ts:11-13
  const c = customers.find((x) => x.slug === slug)
  if (!c) return NextResponse.json({ error: "Customer not found" }, { status: 404 })
  return NextResponse.json({ customer: c })
```

**Impact** — three **invented** customers are published as case studies: "Highland Estates" (212 units, Eldoret), "Coast Living" (84 units, Mombasa), "Kibera Housing Co-op" (245 units, Nairobi). Each carries fabricated, quotable results ("On-time collection 78% → 96%", "First-year ROI 5.4×", "Annual savings KES 1.2M", "Audit prep time −75%") and a **direct quote attributed to a named, titled individual** ("Wanjiru M., Operations Director", "Samuel O., Founder", "Fatma A., Co-op Secretary"). The pages are statically generated (`app/(marketing)/customers/[slug]/page.tsx:8-10`) so they are indexed by search engines, and the same data is served by the **unauthenticated** API `/api/customers/[slug]`. Named quotations and quantified performance claims attributed to identifiable people and organisations that do not exist are a false-advertising problem (in Kenya, the Competition Act and the Consumer Protection Act), and they contradict the repo's own index page, which now says *"No inflated numbers. Just useful tools for the work ahead."* (`app/(marketing)/customers/page.tsx:32-35`).

**Fix**
1. Delete the `customers` array from `lib/content/marketing.ts` (or reduce it to a single, clearly-labelled "example" with no invented quote, no invented person and no invented metric) — and delete `/customers/[slug]` + `app/api/customers/[slug]` if there is nothing to show.
2. If real case studies are wanted, collect written permission and a real quote from the named person, and store the result of a real measurement.
3. Until then, render the index page's honest copy only. The `/customers` index is already correct — make the detail pages consistent with it.
4. Add a review gate: any public page that renders a named person and a metric should need legal sign-off.

---

## LEAK-014 — HIGH — Nine write endpoints only `console.log` and return a fabricated success reference

- **Category:** `mock-feature`
- **Files:** `app/api/newsletter/route.ts:25-30`, `app/api/feedback/route.ts:24-26`, `app/api/pricing/lead/route.ts:30-35`, `app/api/enterprise/lead/route.ts:28-29`, `app/api/customer-requests/route.ts:60-62`, `app/api/contact/route.ts:41-64`, `app/api/support/route.ts:44-56`, `app/api/damages/route.ts:52-54`, `app/api/quotations/route.ts:46-52`

**Evidence**

```ts
// app/api/newsletter/route.ts:7-8 (the route's own doc comment)
 * Stub: in production we push to a Supabase `newsletter_subscribers` table
 * and trigger a confirmation via Resend.
...
    console.info("[newsletter] subscribe", parsed.data)
    return NextResponse.json({
      ok: true,
      message: "Check your inbox for a confirmation.",
    })
```

```ts
// app/api/contact/route.ts:41-64
    // Stub: in production persist to Supabase + send email via Resend.
    console.info("[contact] new message", { ... })
    ...
    const mailto = `mailto:bknglabs.dev@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`
    return NextResponse.json({
      ok: true,
      mailto,
      message: "Your email app is ready with the request filled in. Press Send to contact the PropDesk Africa team.",
    })
```

```ts
// app/api/support/route.ts:40-56
  // No `support_tickets` table exists yet, so a ticket is currently only
  // logged. The reference is still issued and returned so the UI can show
  // the user something, but it is not yet persisted or emailed anywhere —
  // do not present it to a customer as a tracked ticket.
  ...
  return NextResponse.json({
    ok: true,
    ticket: ticketRef,
    message: "We received your ticket and will reply within one business day.",
  })
```

```ts
// app/api/customer-requests/route.ts:44-53  (the vote path)
      const item: RoadmapItem | undefined = roadmap.find((r) => r.slug === parsed.data.slug)
      if (!item) return NextResponse.json({ error: "Idea not found" }, { status: 404 })
      // In-memory: not persisted. In production this writes to a `customer_requests` table
      // with one vote per user per idea (deduped by user id / cookie).
      return NextResponse.json({ ok: true, slug: parsed.data.slug, votes: item.votes + 1 })
```

**Impact** — every one of these endpoints **reports success to the user while doing nothing**:

| Endpoint | Promise made to the user | What actually happens |
|---|---|---|
| `POST /api/newsletter` | "Check your inbox for a confirmation." | `console.info` only — no subscription, no email |
| `POST /api/feedback` | "Idea received. We'll review it within 5 business days." | `console.info` only |
| `POST /api/pricing/lead` | "We'll reach out within one business day to schedule a call." | `console.info` only — **a sales lead is silently lost** |
| `POST /api/enterprise/lead` | "Enterprise team will reach out within one business day." | `console.info` only |
| `POST /api/customer-requests` | `REQ-…` reference | `console.info` only; the **vote** is not persisted either — the vote count in the response (`item.votes + 1`) is never stored, and the client-side board (`components/feedback-board.tsx:39-43`) only mutates React state |
| `POST /api/contact` | "Press Send to contact the PropDesk Africa team." | Builds a `mailto:` for the visitor's own client — the message is **never sent to the business**; the visitor must notice and press Send |
| `POST /api/support` | "We received your ticket and will reply within one business day." | `console.info` only — the code's own comment says *do not present it to a customer as a tracked ticket* |
| `POST /api/damages` | `DMG-…` reference | `console.info` only — the damage record does not exist afterwards |
| `POST /api/quotations` | "Quote request sent. Contractors will respond within 48h." | `console.info` only — no contractor is contacted |

Six of these are **public and unauthenticated**, so a visitor's enquiry can vanish with no trace outside the log store (see `LEAK-004`). The failure mode is the worst kind for a launch: the product looks complete, the confirmation is convincing, and the data is gone. `app/api/contact/route.ts:58` additionally hardcodes the destination mailbox `bknglabs.dev@gmail.com` — a free Gmail address used as the company support channel (also `lib/brand.ts:5`, `app/(marketing)/security/page.tsx:41`).

**Fix**
- For each endpoint, pick one of three honest behaviours: (a) persist the submission to a table and return a real reference; (b) send it to a real transactional email provider; (c) return an explicit "not yet available" response. **Do not return `ok: true` with a success message when nothing happened.**
- The `/api/contact` stub should be replaced by a real POST-to-table plus email, or the UI should be changed to say "this opens your email app" *before* the visitor submits, not after.
- `POST /api/customer-requests?vote=true` must persist into a `customer_requests` table with a per-user unique constraint, and the response must return the stored count, not `item.votes + 1`.
- `components/feedback-board.tsx:39-43` should POST the vote and reconcile with the server response instead of only mutating local state.
- Add a "seed" table set (`newsletter_subscribers`, `contact_submissions`, `support_tickets`, `customer_requests`) to `supabase-setup/` and register them in `PATCH_LOG` (`lib/system.ts:79`).

---

## LEAK-015 — HIGH — Two endpoints return hardcoded rows or silently-ignored filters

- **Category:** `placeholder-data`
- **Files:** `app/api/damages/route.ts:27-40`, `app/api/quotations/route.ts:24-34`

**Evidence**

```ts
// app/api/damages/route.ts:27-40
export const GET = withAuth(async () => {
  const stub = [
    {
      id: "DMG-204",
      title: "Cracked bathroom tile — shower floor",
      property: "Karen House 1",
      severity: "medium",
      status: "in_repair",
      reported_at: "2026-09-12T08:00:00Z",
      cost: 4500,
    },
  ]
  return NextResponse.json({ count: stub.length, damages: stub })
})
```

```ts
// app/api/quotations/route.ts:24-34
export const GET = withAuth(async (request) => {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")
  const propertyId = searchParams.get("property_id")
  const limit = Math.min(Number(searchParams.get("limit") ?? 50) || 50, 100)

  void status
  void propertyId
  void limit
  return NextResponse.json({ count: 0, quotations: [] })
})
```

**Impact** — `/api/damages` returns the **same fabricated damage record to every landlord** ("Cracked bathroom tile — shower floor" at "Karen House 1", KES 4,500, dated 2026-09-12). A new user's dashboard shows another customer's damage, and a user who files a real damage (POST only logs it — `LEAK-014`) will never see their own record; the list will keep showing "Karen House 1" forever. `/api/quotations` returns an empty list while **silently discarding** the `status`, `property_id` and `limit` filters — `void status; void propertyId; void limit` is the compiler being told to ignore the query, so a client that asks for "pending quotes" gets the same empty response as one that asks for everything, with no error. Both endpoints are reached by the dashboard pages `app/dashboard/damages/page.tsx` and `app/dashboard/quotations/page.tsx`.

**Fix**
- Delete the `stub` array and query the real tables with the same `user_id` scoping used elsewhere (`app/api/maintenance/route.ts` is the reference implementation).
- Apply the filters instead of voiding them; if a filter is not yet supported, return `400` rather than silently ignoring it.
- If the tables are not installed yet, use the existing `isMissingTableError` / `throwUnlessMissingTable` helpers (`lib/api/index.ts:100-113`) to return a clear "not enabled yet" state rather than fabricating data.

---

## LEAK-016 — HIGH — "Airtel Money" is offered as a rent payment method with no Airtel integration anywhere

- **Category:** `mock-feature`
- **Files:** `components/payment-form.tsx:218`, `supabase-setup/01-create-tables.sql:99`, `lib/content/site.ts:99-104`, `lib/content/marketing.ts:855`

**Evidence**

```tsx
// components/payment-form.tsx:213-220
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="mpesa">M-Pesa</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="airtel_money">Airtel Money</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
```

```sql
-- supabase-setup/01-create-tables.sql:99
    payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'bank_transfer', 'mpesa', 'airtel_money', 'cheque', 'other')),
```

```ts
// lib/content/site.ts:99-104
  {
    name: "Airtel Money",
    category: "Payments",
    description: "STK-style push for Airtel subscribers across East Africa.",
    status: "Live",
    href: "https://developer.airtel.africa",
  },
```

**Impact** — the only mobile-money integration in the codebase is Safaricom Daraja (`lib/mpesa/daraja.ts`). There is **no Airtel client, no Airtel API call, no Airtel package** anywhere in `app/`, `lib/` or `package.json`. Yet a landlord can record a rent payment as `airtel_money`, and the DB CHECK constraint happily accepts it, and the public integrations catalogue lists Airtel Money as **"Live"** and the sub-processor page lists the "Airtel Money API" as a live processor handling "Phone, amount". A landlord who believes Airtel Money is supported will mark rent as collected by a channel the product cannot reconcile — the money is never requested, never confirmed, never appears in the C2B reconciliation engine (`lib/reconcile.ts`), and the ledger silently diverges from the bank. This is the most dangerous class of mock in the repo because it sits on a **money** path and the UI actively invites its use.

**Fix**
- Remove `airtel_money` from the payment-method `<Select>` in `components/payment-form.tsx` until it is implemented; keep the DB CHECK value so historical rows stay valid, and treat an existing `airtel_money` row as "manual, unreconciled".
- Change the integrations catalogue entry from `status: "Live"` to `status: "Coming soon"` (`lib/content/site.ts:99-104`) and remove "Airtel Money API" from the published sub-processor list (`lib/content/marketing.ts:855`) — see `LEAK-019`.
- If Airtel support is genuinely on the roadmap, gate the option behind a per-account feature flag that defaults to off.

---

## LEAK-017 — HIGH — The public security page promises an audit log and login rate limiting that do not exist

- **Category:** `mock-feature`
- **Files:** `app/(marketing)/security/page.tsx:34-37`, `lib/content/site.ts:67-70`, `app/(marketing)/legal/privacy/page.tsx`

**Evidence**

```tsx
// app/(marketing)/security/page.tsx:34-37
  {
    icon: FileCheck2,
    title: "Audit logs",
    body: "Every sensitive action — login, export, payment, deletion — leaves a tamper-evident trail.",
  },
```

```ts
// lib/content/site.ts:66-70
  {
    version: "v2.3.1",
    date: "2026-07-12",
    title: "Login rate limiting + audit log",
    type: "security",
    body: "Added per-IP rate limiting on /auth/login and a tamper-evident audit log for sensitive actions.",
  },
```

**Impact** — there is **no audit log anywhere in the product**: no `audit_log` table in `supabase-setup/` or `db/migrations/`, no insert on login, export, payment or deletion in any route (the only `reconciliation_audit` writes are M-Pesa reconciliation rows, `app/api/mpesa/c2b/confirmation/route.ts:278`). There is also **no rate limiter** — `app/(marketing)/auth/login/page.tsx` posts to `signIn` in `lib/actions.ts:11-50`, which calls `supabase.auth.signInWithPassword` with no per-IP or per-account throttle, and there is no rate-limit dependency in `package.json`. So the changelog publicly claims a **security control that was never built** — and a security control is exactly the kind of claim a security-conscious landlord (or a procurement reviewer, or a penetration tester) will check. The published "Audit logs" principle on the `/security` page is a false statement in a document written for security assurance.

**Fix**
- Either implement it or retract it. The minimum viable audit log is small: a `security_audit_log` table `(id, user_id, action, target_type, target_id, ip, user_agent, created_at)` plus an `audit()` helper in `lib/` called from the login, export, payment and delete handlers.
- Implement login rate limiting (in-memory per-IP is fine for a single-region Vercel deploy; a `login_attempts` table is more robust): 5 attempts / 15 min / IP+email, returning a `429`.
- Until both exist, delete the "Audit logs" principle from `app/(marketing)/security/page.tsx:34-37` and rewrite the v2.3.1 changelog entry in `lib/content/site.ts:66-70` to describe what actually shipped. A public changelog that misstates a shipped security control is a liability far larger than the missing feature.
- Same review for the other security claims on that page — "Encrypted everywhere" (`:15-17`), "Least-privilege access" (`:20-22`), "Resilient by default" (`:29-32`) — see `LEAK-020`.

---

## LEAK-018 — MEDIUM — The "Data residency" page promises three regions and region pinning that do not exist

- **Category:** `mock-feature`
- **Files:** `app/(marketing)/data/page.tsx:10-32, 45-46, 78-91`, `lib/pricing.ts:29-48`

**Evidence**

```tsx
// app/(marketing)/data/page.tsx:10-32
const regions = [
  {
    flag: "🇪🇺",
    code: "EU-FRA",
    label: "Frankfurt, Germany",
    details: "EU-only customer data. GDPR-compliant by default. ISO 27001 certified facility.",
    available: ["Solo", "Pro", "Agency", "Enterprise"],
  },
  {
    flag: "🇰🇪",
    code: "KE-NBO",
    label: "Nairobi, Kenya",
    details: "Default for African customers. Local data residency for Kenya Data Protection Act compliance.",
    available: ["Solo", "Pro", "Agency", "Enterprise"],
  },
```

```tsx
// app/(marketing)/data/page.tsx:45-46
            Three regions. One product.
// app/(marketing)/data/page.tsx:78-91
            { icon: Database, title: "Region-pinning", body: "Agency and Enterprise customers can pin a region. The platform never leaves it." },
```

**Impact** — the page tells a prospect *"You pick the region. Your data stays there"*, lists three hosting regions with an "ISO 27001 certified facility", offers per-plan availability of "Solo / Agency / Enterprise" plans, and promises region pinning for Agency and Enterprise customers. In reality: `lib/pricing.ts:29-48` defines exactly **one** plan (`pro`) with no regional variants; there is **no** region selector control on the page (it is a static grid of three cards — `page.tsx:57-72` renders `<div>`s, not links or buttons); there is no `region` column, no region routing and no per-region deployment in the code; and the actual data plane is a single Neon database (`lib/db/neon.ts:26`) plus a single Supabase project (`lib/supabase/service.ts:16`). A prospect evaluating for GDPR or Kenya Data Protection Act compliance will read a commitment the product cannot honour — and the "Solo" plan it references does not exist.

**Fix**
- Delete the page, or rewrite it to describe the **actual** single-region deployment (name the provider and the region), and delete the region-pinning and ISO-27001 claims.
- If multi-region is a real roadmap item, say so explicitly as a roadmap entry (the `/roadmap` page already has a "Later" bucket) rather than presenting it as a current capability.
- Remove the "Solo" and "Agency" plan names from every plan-referencing surface; `lib/pricing.ts:48-71` is the single source of truth and lists only `pro`.

---

## LEAK-019 — MEDIUM — Public sub-processor and privacy disclosures name vendors that are not integrated

- **Category:** `shipped-sample-data`
- **Files:** `lib/content/marketing.ts:850-859`, `app/(marketing)/legal/privacy/page.tsx:50-64`, `app/(marketing)/sub-processors/page.tsx`

**Evidence**

```ts
// lib/content/marketing.ts:850-859
export const subProcessors: SubProcessor[] = [
  { name: "Supabase", purpose: "PostgreSQL hosting", data: "All primary data", region: "EU (Frankfurt), KE (Nairobi)", policy: "supabase.com/legal" },
  { name: "Vercel", purpose: "Application hosting", data: "Edge function logs", region: "Global edge", policy: "vercel.com/legal/privacy" },
  { name: "Resend", purpose: "Transactional email", data: "Email addresses, body", region: "US", policy: "resend.com/legal/privacy-policy" },
  { name: "Safaricom Daraja", purpose: "M-Pesa processing", data: "Phone, amount, account #", region: "Kenya", policy: "safaricom.co.ke/privacy" },
  { name: "Airtel Money API", purpose: "Airtel Money processing", data: "Phone, amount", region: "Pan-Africa", policy: "airtel.africa/privacy" },
  { name: "Amazon Web Services", purpose: "Encrypted backups", data: "Database snapshots", region: "EU + KE", policy: "aws.amazon.com/privacy" },
  { name: "Cloudflare", purpose: "DDoS protection, WAF", data: "Request metadata", region: "Global edge", policy: "cloudflare.com/privacypolicy" },
  { name: "Sentry", purpose: "Error monitoring", data: "Stack traces", region: "EU + US", policy: "sentry.io/privacy" },
]
```

```tsx
// app/(marketing)/legal/privacy/page.tsx:50-64
          <Section title="3. Where it's stored">
            <p>
              Your data is stored in our Supabase (PostgreSQL) project, hosted on AWS. Backups are
              encrypted at rest and in transit. ...
          <Section title="4. Who we share it with">
            <p>We never sell your data. We share it only with:</p>
              <li><b>Resend / SendGrid</b> — to deliver transactional emails.</li>
```

**Impact** — the published sub-processor register and the privacy policy name **Resend, SendGrid, Amazon Web Services, Cloudflare, Sentry, Airtel Money** and describe the stack as "Supabase … hosted on AWS". None of Resend, SendGrid, AWS, Cloudflare, Sentry or Airtel appear in `package.json` or anywhere in `app/` or `lib/` — a repo-wide grep for `resend|sentry|airtel|cloudflare|amazonaws` returns only these two content files. The actual stack is **Neon Postgres** (`lib/db/neon.ts:26`), Supabase (auth + storage), Vercel, Safaricom Daraja and Stripe. There is no transactional email provider at all — which is exactly why every lead form is a stub (`LEAK-014`). A sub-processor register is a compliance artefact: publishing processors that do not exist, and omitting the ones that do (Neon, Stripe), is worse than publishing none. It also tells a prospect the backups live on AWS when they live in a Supabase Storage bucket.

**Fix**
- Regenerate `subProcessors` from the actual deployment: Neon (database), Supabase (auth + storage), Vercel (hosting), Safaricom Daraja (M-Pesa), Stripe (card billing). Delete the rest.
- Correct the privacy policy §3 and §4 to name Neon, Stripe and the real email provider (once one exists). If no email provider is configured, say "transactional email is not yet configured" rather than naming two.
- Keep the register next to the code and add a CI check that every `subProcessors[].name` appears in `package.json` or in a `providers` map, so it cannot drift again.

---

## LEAK-020 — MEDIUM — Public copy claims "row-level security on every table" for a database that has none

- **Category:** `shipped-sample-data`
- **Files:** `app/(marketing)/security/page.tsx:20-22`, `app/(marketing)/legal/privacy/page.tsx:50-55`, `lib/db/neon.ts:4-12`, `lib/api/with-db-auth.ts:14-15`

**Evidence**

```tsx
// app/(marketing)/security/page.tsx:19-22
  {
    icon: KeyRound,
    title: "Least-privilege access",
    body: "Row-level security on every Supabase table. Staff access is logged and time-limited.",
  },
```

```tsx
// app/(marketing)/legal/privacy/page.tsx:50-55
          <Section title="3. Where it's stored">
            <p>
              Your data is stored in our Supabase (PostgreSQL) project, hosted on AWS. Backups are
              encrypted at rest and in transit. We use Supabase's row-level security to ensure that
              one landlord can never see another landlord's data.
            </p>
```

**Impact** — the primary database is **Neon Postgres**, which has no RLS at all; isolation is achieved entirely by `user_id` predicates written in application code (`lib/db/neon.ts:4-12`: *"There is NO row-level security on Neon. Every query must be scoped by the authenticated user's id in application code"* — `lib/api/with-db-auth.ts:14-15` says the same). The security page and the privacy policy both tell users that a database-enforced control guarantees tenant isolation. That is the exact guarantee a security reviewer will test, and the app's own code comments say it is not provided. The two claims can be true simultaneously only because the app runs on two database backends (`lib/db/neon.ts:9-12` documents the Neon→Supabase fallback), and the public copy describes only the Supabase half. "Staff access is logged and time-limited" is also unbacked — there is no staff access at all, and no access log (see `LEAK-017`).

**Fix**
- Rewrite the security principle and the privacy section to state the actual model: "Every query is scoped to your workspace by your account id, and every table on our Supabase project also has row-level security enabled." Name Neon explicitly in the privacy policy's "where it's stored" section.
- Remove "Staff access is logged and time-limited" (no staff access exists) or implement the access log.
- Review every other security claim on that page against the code, and add a line in the audit process: *"no public security/compliance claim ships without a code citation."*

---

## LEAK-021 — MEDIUM — Fabricated download counts, vote counts, changelog releases and status-page incidents

- **Category:** `shipped-sample-data`
- **Files:** `lib/content/marketing.ts:584-696` (downloads), `lib/content/marketing.ts:706-717` (votes), `lib/content/site.ts:27-80` (changelog), `lib/content/site.ts:173-199` (incidents), `components/feedback-board.tsx:17-26`, `app/api/roadmap/route.ts:6-13`

**Evidence**

```ts
// lib/content/marketing.ts:590, 599, 608, 617, 626, 635, 644, 653, 662, 671, 680, 689
    downloads: 28,   // kenya-residential-lease
    downloads: 24,
    downloads: 22,
    ...
```

```ts
// lib/content/marketing.ts:707-714
  { slug: "ai-rent-default-prediction", ..., votes: 412 },
  { slug: "owner-portal", ..., votes: 287 },
  { slug: "contractor-app", ..., votes: 198 },
  { slug: "recurring-expenses-ai", ..., votes: 165 },
  { slug: "whatsapp-tenant-bot", ..., votes: 340 },
  { slug: "smart-lease-templates", ..., votes: 122 },
  { slug: "rent-negotiation-tool", ..., votes: 87 },
  { slug: "investor-read-only", ..., votes: 154 },
```

```ts
// lib/content/site.ts:173-199
export const statusIncidents: StatusIncident[] = [
  { id: "INC-2026-10-02", date: "2026-10-02", title: "Elevated STK Push latency", status: "Resolved", severity: "minor",
    body: "From 14:08 to 14:47 EAT, some M-Pesa STK Push requests took longer than usual ... We rerouted around a Daraja edge node and re-tested at 14:55." },
  { id: "INC-2026-09-21", ..., title: "Reports page slow on large portfolios", ... },
  { id: "INC-2026-09-04", ..., title: "Email delivery degraded", severity: "major",
    body: "Transactional emails were queued but not sent for ~40 minutes due to an upstream provider issue. We migrated to a backup provider and queued messages were flushed at 12:18 EAT." },
]
```

**Impact** — the template catalogue shows a precise download count for each of 12 templates (none of which has a download-tracking implementation — the counts are literals). The roadmap exposes 8 fabricated vote counts through the **unauthenticated** API `/api/roadmap` and through `components/feedback-board.tsx:18-25`, so a visitor sees "412 votes" and "340 votes" for features that do not exist. The status page publishes three specific incidents with precise EAT timestamps — including "Email delivery degraded … major … migrated to a backup provider" — for a product that has **no email provider at all** (`LEAK-019`, `LEAK-014`). The changelog (`lib/content/site.ts:27-80`) presents seven shipped releases (v2.3.0 → v2.6.0) describing CSV import, recurring expenses, reports and export-to-PDF, none of which match the product; meanwhile the app's own version endpoint reports `APP_VERSION = "5.0.0"` (`lib/system.ts:57`), so the published changelog and the running product disagree about their own version history. A status page that invents an outage is a serious trust problem, and invented download/vote counts on a marketing page are false advertising.

**Fix**
- Delete the fabricated numbers. Template downloads: omit the count, or add a real counter (a `template_downloads` table incremented by the download route). Roadmap votes: show votes only if they are real; otherwise render the ideas without counts. Status incidents: show an empty "No incidents recorded" state until there is a real incident log (feed it from the monitoring system). Changelog: rewrite from the actual release history, or show only the current version with a link to the git history.
- Add `app_version` to the changelog source of truth and derive the marketing changelog from it, so the two can never disagree again.

---

## LEAK-022 — MEDIUM — Placeholder and dead links in public navigation (Discord invite, forum, office hours, press assets)

- **Category:** `mock-feature`
- **Files:** `app/(marketing)/community/page.tsx:15, 22, 36`, `app/(marketing)/press/page.tsx:15-16`

**Evidence**

```tsx
// app/(marketing)/community/page.tsx:13-16
  {
    icon: MessageCircle,
    name: "Discord",
    description: "4,200+ landlords, agencies and developers. Real-time help, weekly office hours.",
    href: "https://discord.gg/i-manage",
    cta: "Join the Discord",
  },
```

```tsx
// app/(marketing)/community/page.tsx:20-23
    name: "Forum",
    description: "Long-form discussions, feature debates and product feedback.",
    href: "/community/forum",
```

```tsx
// app/(marketing)/community/page.tsx:33-37
    name: "Office hours",
    description: "Weekly 1-hour video call with the founders. Every Thursday, 4pm EAT.",
    href: "/community/office-hours",
```

```tsx
// app/(marketing)/press/page.tsx:15-16
  { name: "Brand guidelines", size: "Text document", href: "/press/brand-guidelines.txt", download: true },
  { name: "Company fact sheet", size: "Text document", href: "/press/company-fact-sheet.txt", download: true },
```

**Impact** — `https://discord.gg/i-manage` is a **placeholder invite slug**, not a real server: a visitor clicking "Join the Discord" (on a page that claims "4,200+ landlords, agencies and developers hang out with us") lands on a Discord error or, worse, on somebody else's server. `/community/forum` and `/community/office-hours` **do not exist** — `app/(marketing)/community/` contains only `page.tsx` — so both are 404s from a page that also promises "Every Thursday, 4pm EAT" office hours. `/press/brand-guidelines.txt` and `/press/company-fact-sheet.txt` are also 404s: `public/press/` does not exist, and the press page offers them as **downloadable press assets** to journalists. These are the links a journalist or a prospective landlord is most likely to click, and every one of them is broken or fake.

**Fix**
- Create the real Discord server and put the permanent invite URL in `app/(marketing)/community/page.tsx:15`; until then, remove the Discord card or mark it "Coming soon" without a link.
- Remove the Forum and Office-hours cards, or build `/community/forum` and `/community/office-hours`.
- Add the two press files to `public/press/` (they are two short text documents), or remove them from the press kit.
- Add a link checker to CI: crawl the rendered site and fail on 4xx/5xx and on `href` values pointing at non-existent local routes. This class of defect is trivially automatable.

---

## LEAK-023 — LOW — Marketing mockups present fabricated financial figures as if they were product output

- **Category:** `placeholder-data`
- **Files:** `components/marketing-site.tsx:240`, `app/(marketing)/app/page.tsx:96-102`

**Evidence**

```tsx
// components/marketing-site.tsx:240 (excerpt)
...<p className="text-xs uppercase tracking-[0.2em] text-white/50">Portfolio overview</p>
   <p className="mt-2 text-2xl font-medium">October, 2026</p> ...
   <p className="text-xs text-white/50">Portfolio value</p>
   <p className="mt-3 text-2xl">KES 48.2M</p>
   <p className="mt-2 text-xs text-[#d9f45b]">↑ 12.4% this year</p> ...
   <p className="text-xs text-white/50">Collected this month</p>
   <p className="mt-3 text-2xl">KES 3.84M</p>
   <p className="mt-2 text-xs text-[#d9f45b]">94.8% collected</p>
   ... <span>APR</span><span>OCT</span>  (7-bar fake chart)
```

```tsx
// app/(marketing)/app/page.tsx:96-102
                    { k: "Rent collected", v: "KES 184,500", c: "text-success" },
                    { k: "Pending payments", v: "2 tenants", c: "text-warning" },
                    { k: "Open maintenance", v: "1 urgent", c: "text-destructive" },
                    { k: "Leases expiring", v: "in 14 days", c: "text-muted-foreground" },
```

**Impact** — these are illustrative screenshots on the marketing home page and the product page. They are not labelled as mock-ups, and they present concrete numbers (KES 48.2M portfolio value, 94.8% collection rate, KES 184,500 collected) in the visual language of a real dashboard. A prospect comparing them with the (empty) real product may reasonably believe those are typical results. Lower risk than `LEAK-013` because no customer is named and no quote is attributed, but the same "looks like a claim, isn't one" problem.

**Fix**
- Add a discreet "Illustrative example" caption to mock-up panels, or replace the numbers with obviously non-real placeholders (`KES —`, `—`).
- Prefer screenshots taken from a seeded demo workspace (so the numbers are internally consistent) over hand-typed values.

---

## LEAK-024 — LOW — Sample documents published as public binaries, stale relative to their generator

- **Category:** `shipped-sample-data`
- **Files:** `public/templates/preview/*.docx` (10 tracked files), `scripts/prebuild-templates.ts:19-92`, `lib/brand.ts:14-29`

**Evidence**

```
scripts/prebuild-templates.ts:21-27
      landlordName: "Acme Property Holdings Ltd",
      landlordAddress: "P.O. Box 1234, Nairobi",
      landlordId: "PVT-XYZ123456",
      tenantName: "Sample Tenant",
      tenantId: "12345678",
      tenantPhone: "0712 345 678",
      propertyName: "Kileleshwa Apartments — Unit 3B",
```

but the **committed** `.docx` files (extracted `word/document.xml`) contain a *different* sample set:

```
lease.docx       → Landlord: "Achieng Odhiambo", Tenant: "Brian Mwangi",
                   National ID / Company Reg. No.: "29****41", National ID No.: "35****88"
checklist.docx   → "Achieng Odhiambo"
complaint.docx   → Reported by: "Brian Mwangi", Property: "Riverside Court, Riverside Drive, Nairobi"
receipt.docx     → Received from "Brian Mwangi", Tenant ID "35****88", Amount KES 85,000
```

**Impact** — the 10 `.docx` files in `public/templates/preview/` are served from the unauthenticated `/public/` path and are the download targets for the public template catalogue (`lib/brand.ts:14-29` maps every template slug to one of them). The names, addresses and ID numbers inside are synthetic (the IDs are masked as `29****41` / `35****88` and the phone as `07XX XXX XXX`), so this is **not** a PII leak — but (a) the files carry no "SAMPLE / NOT A REAL LEASE" marking, so a user can mistake them for a real executed document; (b) the committed binaries do not match the generator script, so re-running `npm run templates:prebuild` produces different files and a spurious diff — a sign the checked-in copies are stale; and (c) `public/templates/legacy/complaint-report.txt` is a legacy plain-text form still sitting in the public folder, and `public/templates/property-import.csv` / `tenant-import.csv` still carry their "Example Unit" / "Example Tenant" placeholder rows.

**Fix**
- Regenerate the committed `.docx` files from `scripts/prebuild-templates.ts` so the script and the artefacts agree, and add a "SAMPLE — NOT A REAL AGREEMENT" footer to every generated template.
- Keep the generator's sample data deliberately fake (`0700000000`, `PVT-000000000`, `Example Unit`) and never use a plausible Kenyan national-ID pattern.
- Delete `public/templates/legacy/` (nothing links to it) and clear the example rows out of the two import CSVs, or keep them but mark the first row as an example in the CSV header comment.

---

## LEAK-025 — LOW — Placeholder analytics claims and an unused analytics dependency

- **Category:** `placeholder-data`
- **Files:** `app/(marketing)/customer-requests/page.tsx:47`, `app/(marketing)/developers/page.tsx:72`, `app/(marketing)/integrations/page.tsx:113`, `app/(marketing)/community/page.tsx:14,53`, `package.json:57`

**Evidence**

```tsx
// app/(marketing)/customer-requests/page.tsx:47
            { k: "92%", v: "Of shipped ideas came from this board" },
// app/(marketing)/developers/page.tsx:72
            { k: "99.99%", v: "Webhook delivery" },
// app/(marketing)/integrations/page.tsx:113
                <span className="font-mono text-accent">99.9% (Agency)</span>
// app/(marketing)/community/page.tsx:14,53
    description: "4,200+ landlords, agencies and developers. Real-time help, weekly office hours.",
    "4,200+ landlords, agencies and developers hang out with us. We answer everything,
```

**Impact** — four public pages quote precise, unverifiable operational metrics: "92% of shipped ideas came from this board" (the board has no persistence at all — `LEAK-014`), "99.99% webhook delivery" and "99.9% (Agency)" uptime for a product that has **no outbound webhook implementation** (the webhooks feature is only documented — `lib/content/marketing.ts:207-215`, `lib/content/marketing.ts:459-495` — and there is no `webhooks` route or table anywhere in `app/`), and "4,200+ landlords" for a product that has not launched. These are the numbers a procurement questionnaire will ask about, and none of them is measurable.

Separately and positively: **`@vercel/analytics` is installed (`package.json:57`) but never imported anywhere** — a repo-wide grep for `Analytics` in `app/`/`components/` returns only the legal copy at `app/(marketing)/legal/cookies/page.tsx:40-43` and the heading "Reports & Analytics" at `app/dashboard/reports/page.tsx:97`. **No analytics collector is running, so no identifiable user data is captured by analytics** — the "Analytics cookies (optional)" section of the cookie policy is describing a cookie that is never set. Either wire up Vercel Analytics or remove the dependency and correct the cookie policy.

**Fix**
- Delete the unverifiable metrics, or replace them with the real numbers once the product has them. Never publish an SLA figure that is not measured — "99.9% uptime" is a contractual statement, not decoration.
- Remove `@vercel/analytics` from `package.json` if it is not used, and update `app/(marketing)/legal/cookies/page.tsx:40-43` to describe the cookies that are actually set (`theme-provider` / `cookie-consent` cookies).

---

## Findings index

| ID | Severity | Category | Location | One-line |
|---|---|---|---|---|
| LEAK-001 | HIGH | public-asset-leak | `public/backup-replication-fixture.json:8-15` | Real name/phone/address/company PII in a public static file, linked from the dashboard |
| LEAK-002 | **CRITICAL** | public-asset-leak | `supabase-setup/01-create-tables.sql:326-328` | `documents` bucket created `public = true` → tenant KYC/leases world-readable |
| LEAK-003 | MEDIUM | gitignore-gap | `.gitignore:19-20` | No env template can be committed; DB dumps / `public/backups/` not excluded |
| LEAK-004 | HIGH | pii-in-logs | `app/api/newsletter/route.ts:25` +8 more | Nine endpoints `console.log` raw emails, names and free-text bodies |
| LEAK-005 | HIGH | pii-in-response | `app/api/mpesa/c2b/status/[transId]/route.ts:36-41` | Unscoped Daraja lookup returns the payer's MSISDN and full name |
| LEAK-006 | MEDIUM | pii-in-response | `app/api/tenants/route.ts:29-33` | Tenant list returns `national_id`, emergency contact and notes for every row |
| LEAK-007 | MEDIUM | pii-in-response | `app/api/export/route.ts:21-23` | Export/backup include national ID; the redaction list only covers secret-shaped columns |
| LEAK-008 | MEDIUM | pii-in-response | `app/api/documents/route.ts:26-30` | Document list hands out the public `file_url` and free-text notes |
| LEAK-009 | MEDIUM | verbose-error | `lib/api/with-db-auth.ts:81-87, 104-108` | Raw exception text + "DATABASE_URL is not configured…" to the client |
| LEAK-010 | MEDIUM | verbose-error | 41 sites (e.g. `app/api/tenants/route.ts:39`) | `errorResponse(error.message, 500)` leaks schema/constraint names |
| LEAK-011 | MEDIUM | verbose-error | `app/api/mpesa/stkpush/route.ts:58,85` | Upstream Daraja error text and `raw_response` returned to the browser |
| LEAK-012 | MEDIUM | verbose-error | `components/system-info.tsx:101,160` | SQL error text rendered in the dashboard UI |
| LEAK-013 | HIGH | shipped-sample-data | `lib/content/marketing.ts:736-800` | Fabricated case studies with named quotes and metrics, prerendered + API-exposed |
| LEAK-014 | HIGH | mock-feature | `app/api/newsletter/route.ts:25` +8 more | Nine write endpoints only log and return a fake success reference |
| LEAK-015 | HIGH | placeholder-data | `app/api/damages/route.ts:27-40` | Hardcoded damage row for every user; quotations filters silently discarded |
| LEAK-016 | HIGH | mock-feature | `components/payment-form.tsx:218` | "Airtel Money" payment method with no Airtel integration |
| LEAK-017 | HIGH | mock-feature | `app/(marketing)/security/page.tsx:34-37` | Audit log + login rate limiting promised publicly, neither exists |
| LEAK-018 | MEDIUM | mock-feature | `app/(marketing)/data/page.tsx:10-32` | Three-region residency / region pinning promised, does not exist |
| LEAK-019 | MEDIUM | shipped-sample-data | `lib/content/marketing.ts:850-859` | Sub-processor register names six unintegrated vendors, omits Neon and Stripe |
| LEAK-020 | MEDIUM | shipped-sample-data | `app/(marketing)/legal/privacy/page.tsx:50-55` | "Row-level security on every table" for a Neon DB that has none |
| LEAK-021 | MEDIUM | shipped-sample-data | `lib/content/site.ts:173-199` | Invented download counts, vote counts, changelog and status incidents |
| LEAK-022 | MEDIUM | mock-feature | `app/(marketing)/community/page.tsx:15,22,36` | Placeholder Discord invite, dead `/community/*` and `/press/*` links |
| LEAK-023 | LOW | placeholder-data | `components/marketing-site.tsx:240` | Fabricated portfolio figures in marketing mock-ups |
| LEAK-024 | LOW | shipped-sample-data | `public/templates/preview/*.docx` | Sample documents published unmarked and stale vs their generator |
| LEAK-025 | LOW | placeholder-data | `app/(marketing)/customer-requests/page.tsx:47` | "92% / 99.99% / 4,200+" unverifiable metrics; unused analytics dep |

**Clean / no finding raised (stated explicitly, not padded):**

- **Scope A.1 — hardcoded credentials: CLEAN.** No live key, token, password, connection string, JWT or private key in the tree, the lockfiles, `public/` or `.v0-assets/`.
- **Scope A.2 — no secret is `NEXT_PUBLIC_`.** No client component reads `process.env`. No secret is logged, echoed in a response, or sent to the browser.
- **Scope B.4 — analytics capture: CLEAN.** `@vercel/analytics` is declared but never imported; no analytics collector runs and no identifiable data is captured. (The cookie policy describes a cookie that is never set — covered as part of `LEAK-025`.)
- **Scope B.2 — no SQL text, stack trace or table name is returned from the Neon/PostgREST error *values* in the dashboard pages**; the leaks are the `error.message` passthroughs listed above.
- **Scope C.4 — sample credentials: CLEAN.** No demo login, no default password, no `admin/admin`, no seeded credential, and no seed script that runs in production. Sign-up is blocked until `supabase-setup/00-signup-bootstrap.sql` is applied (`lib/actions.ts:83-85`).
- **Scope C.5 — `.v0-assets/favicon_io.zip`: CLEAN.** Contains 7 icon files only.

---

## Remediation status (owner-side pass, after this track reported)

This file is the original finding write-up. The **current status of every
finding in this track** lives in `audit/findings/leaks.json` — each entry carries a `status`
(`FIXED` / `PARTIAL` / `OPEN` / `DONE`) and a `fix_notes` field describing
what was actually changed.

Track summary as of the end of the hardening pass:

| Severity | Total | FIXED | PARTIAL | OPEN | DONE |
|---|---:|---:|---:|---:|---:|
| CRITICAL | HIGH | LOW | MEDIUM | 25 | 8 | 5 | 12 | 0 |


The headline for this track: raw database errors no longer reach the client, the nine public write endpoints persist for real, and the founder's details are out of the public fixture. What remains is mostly public copy that promises controls the product does not have.

See `AUDIT_REPORT.md` for the consolidated verdict and `HARDENING_RUNBOOK.md`
for the go-live sequence.
