# PropDesk Africa — hardening runbook

Operational runbook for the pre-launch hardening pass. Every command below was
run against this repository; every "verify" step tells you what a passing
result looks like.

Audience: the owner/operator of the platform, and whoever deploys it.

---

## 1. The one-page launch checklist

Nothing ships until every box below is ticked.

### 1.1 Code and dependencies

- [ ] `npm ci` completes with no audit error at CRITICAL severity.
- [ ] `npx tsc --noEmit` reports **no new errors** against
      `audit/baseline/tsc-baseline.log` (the baseline is 54 pre-existing
      errors; the count after the hardening pass is 52).
- [ ] `npm test` is fully green (146 tests across 6 files).
- [ ] `npm run build` succeeds with `typescript.ignoreBuildErrors` **removed**
      from `next.config.mjs`. The build must fail on a type error — that is the
      whole point of turning the flag off.
- [ ] `npm ls next` shows `16.4.3` or later.

### 1.2 Secrets and environment

- [ ] Every variable in `.env.example` that is marked required is set in the
      hosting provider's dashboard — **not** in a committed file.
- [ ] `PROPDESK_ENCRYPTION_KEYS` and `PROPDESK_BLIND_INDEX_KEYS` are set, and
      the two keys are **different values** (reusing one key for encryption and
      for the blind index breaks both).
- [ ] `MPESA_ENV` is set explicitly to `production` in production.
- [ ] `MPESA_ALLOWED_CALLBACK_IPS` is set to Safaricom's real callback IPs.
- [ ] `MPESA_SANDBOX_MOCK` is **not** set in production.
- [ ] `MPESA_ADMIN_EMAILS` is set if you intend to use the Daraja callback
      registration endpoint at all. If it is unset, that endpoint refuses
      everyone — which is the safe default.

### 1.3 Database

- [ ] Core migrations applied: `npm run db:migrate`.
- [ ] Patch SQL applied: `POST /api/migrations/run` with `MIGRATION_SECRET`.
- [ ] `db/migrations/005-encryption.sql` applied **after** the encryption keys
      are set (see §4).
- [ ] The `documents` bucket is private in the live Supabase project (see §6).

### 1.4 Copy and claims

- [ ] Every claim on the public site matches what the product does. The
      outstanding list is in `audit/findings/features.json` — the important
      ones are the row-level-security claim, the data-residency claim, the
      account-deletion promise, the audit-log promise and Airtel Money.

---

## 2. Environment variables

Full list with comments: `.env.example`. Generation commands:

```bash
# 32 random bytes, base64 — for the AES-256 encryption key and the blind index key
openssl rand -base64 32

# 32 random bytes, hex — for the three shared secrets
openssl rand -hex 32

# 16 random bytes, hex — for the rate-limiter salt
openssl rand -hex 16
```

The encryption key registry accepts either JSON or CSV:

```bash
# JSON (recommended)
PROPDESK_ENCRYPTION_KEYS='{"v1":"<base64 32 bytes>"}'

# CSV
PROPDESK_ENCRYPTION_KEYS='v1=<base64 32 bytes>'
```

A key that does not decode to exactly 32 bytes is rejected with an actionable
error. There is no default and no fallback — the code fails loudly instead.

**Never** put a secret in a `NEXT_PUBLIC_` variable, in a log line, in an API
response, or in a commit.

---

## 3. Migration order

There are two migration systems in this repository and they are applied by
different mechanisms. Confusing them is the easiest way to end up with a
half-migrated database.

| Set | Directory | Mechanism | What is in it |
|---|---|---|---|
| Core | `db/migrations/` | `npm run db:migrate` (calls `lib/db/migrate.ts`) | `001-core.sql`, `002-support.sql`, `004-marketing-forms.sql`, `005-encryption.sql` |
| Patch | `supabase-setup/` | `POST /api/migrations/run` with `MIGRATION_SECRET` (see `PATCH_LOG` in `lib/system.ts`) | `01-create-tables.sql` … `13-paybill-counters.sql` |

### 3.1 Order

```bash
# 1. Core schema (idempotent, safe to re-run)
npm run db:migrate

# 2. Patch set — this is what creates the `documents` Storage bucket,
#    the SECURITY DEFINER functions and their grants.
curl -X POST https://app.propdesk.africa/api/migrations/run \
  -H "Content-Type: application/json" \
  -H "X-Migration-Secret: $MIGRATION_SECRET"

# 3. Encryption indexes — AFTER the encryption keys are set in the environment
npm run db:migrate

# 4. Backfill (see §4) — AFTER step 3
npm run db:encrypt-backfill -- --dry-run
npm run db:encrypt-backfill
```

### 3.2 The migration runner (fixed in this pass)

`npm run db:migrate` used to be broken: it split a migration file on "a
semicolon at the end of a line" and then **discarded every chunk that started
with a `--` comment**, so real statements that merely followed a comment block
were thrown away. In `001-core.sql` that was every `create table`; in `004` and
`005` it was the blind-index `alter table` statements — after which the runner
died on the surviving `create index` with "column does not exist" and left the
schema half-migrated.

The splitter is now comment-aware: it strips `--` comments instead of
discarding the statement that followed them, ignores a `;` inside a
single-quoted string, and keeps `$$ … $$` function bodies intact. Covered by
`lib/db/migrate.test.ts`.

**Verify it after the first run.** The applied statements should match the
file:

```bash
psql "$DATABASE_URL" -c "select name, applied_at from public._migrations order by name;"
psql "$DATABASE_URL" -c "\d public.tenants" | grep blind_index
```

If a migration reports `failed`, the error message names the statement — read
it before re-running, because the runner tolerates "already exists" and
continues past it.

### 3.3 Known schema gap

`damages` and `quotations` are created only by `supabase-setup/10-holy-grail.sql`.
They are **not** in `db/migrations/`. A deployment that runs only the core
migrations will be missing both tables, and the damages and quotations features
will fail at runtime.

Fix before launch — either move those two tables into `db/migrations/006-*.sql`
or add them to the core migration runner. They are also where the additive
columns `damages.unit_id` and `quotations.contractor_ids` (added by
`004-marketing-forms.sql`) land, so the order matters.

### 3.4 Verifying the database is in the expected state

```bash
# Tables that must exist
psql "$DATABASE_URL" -c "\dt public.*" | grep -E "damages|quotations|newsletter_subscribers|contact_submissions|support_tickets|customer_requests"

# Blind-index columns (only after step 3)
psql "$DATABASE_URL" -c "\d public.tenants" | grep blind_index

# The bucket must NOT be public
# -> in the Supabase dashboard: Storage -> documents -> Configuration -> Public = OFF
```

---

## 4. Encryption rollout

The encryption core is implemented, but **the live data is not yet encrypted**.
This section is the actual rollout. Do not skip it.

The design is in `audit/design/encryption-design.md`; the implementation is
`lib/crypto/field-encryption.ts` and `lib/crypto/pii-columns.ts`.

### 4.1 What gets encrypted

| Table | Columns |
|---|---|
| `public.tenants` | `full_name`, `first_name`, `last_name`, `email`, `phone`, `national_id` |
| `public.c2b_transactions` | `msisdn`, `first_name`, `middle_name`, `last_name` |
| `public.mpesa_transactions` | the phone/name columns that exist in `002-support.sql` |

Searchable columns (`email`, `phone`, `msisdn`) additionally get an HMAC-SHA256
blind index in a `*_blind_index` column, so a lookup still works without
decrypting the whole table.

### 4.2 The order that matters

1. **Set the keys.** `PROPDESK_ENCRYPTION_KEYS` and `PROPDESK_BLIND_INDEX_KEYS`.
   The application fails loudly without them — that is intended.
2. **Apply `005-encryption.sql`.** It adds the blind-index columns. Until this
   runs, the encrypt-on-write path has nowhere to store an index.
3. **Move the sensitive reads behind the server — PHASE 0, BLOCKING.**
   The dashboard currently reads `tenants` straight from the browser using the
   anon key. The browser cannot decrypt, so until these pages go through a
   server route, encryption renders `v1:…` in the UI. The pages to convert:

   | File | Client-side read to remove |
   |---|---|
   | `app/dashboard/tenants/page.tsx` | `from("tenants")` |
   | `app/dashboard/tenants/[id]/page.tsx` | `from("tenants")` |
   | `app/dashboard/tenants/[id]/edit/page.tsx` | `from("tenants")` |
   | `app/dashboard/properties/[id]/page.tsx` | `from("tenants")` |
   | `app/dashboard/contacts/page.tsx` | `from("contacts")` |
   | `app/dashboard/paybill/page.tsx` | `from("paybills")` |
   | `app/dashboard/reconciliation/page.tsx` | `from("c2b_transactions")` |
   | `app/dashboard/reports/page.tsx`, `app/dashboard/settings/page.tsx` | `from("tenants")` |

   Prefer the existing API routes (`/api/tenants`, `/api/documents`,
   `/api/paybill`, `/api/properties/[id]/photos`) — they already scope by
   `user_id`.
4. **Convert the write paths** — `encryptRow(table, payload)` before every
   insert/update: `app/api/tenants/route.ts` (POST), `app/api/tenants/[id]/route.ts`
   (PUT), `app/api/mpesa/stkpush/route.ts`, `app/api/mpesa/c2b/confirmation/route.ts`,
   `app/api/profile/route.ts`.
5. **Convert the read paths** — `decryptRow(table, row)` before returning:
   `app/api/tenants/route.ts` (GET), `app/api/tenants/[id]/route.ts` (GET),
   `app/api/export/route.ts`, `app/api/backup/csv/[table]/route.ts`,
   `app/api/mpesa/c2b/confirmation/route.ts` (before the in-memory phone
   comparison), `app/api/paybill/route.ts`.
6. **Replace the plaintext phone lookups with blind-index lookups.**
   `app/api/mpesa/c2b/validation/route.ts` currently does
   `where phone = $1 or phone like '%' || $2`. That has to become
   `where phone_blind_index = any($1) and t.user_id = $owner` using
   `blindIndexCandidates(normalizePhoneE164(msisdn))`. **Without the owner scope
   that endpoint is a cross-tenant oracle.** The same applies to
   `resolveOwnerByShortCode` in `app/api/mpesa/c2b/confirmation/route.ts` —
   without the blind-index lookup, the M-Pesa callback stops finding the
   landlord.
7. **Fix the SQL-side reader.** `public.run_lease_expiry_scan()` in
   `db/migrations/002-support.sql` reads `t.full_name`, `t.first_name` and
   `t.last_name` **in SQL** and interpolates them into the notification text.
   Once those columns hold envelopes, the notification text will contain
   `v1:…`. That function has to stop reading the columns directly.
8. **Backfill.**
9. **Rebuild the blind indexes.**

The full checklist, with line anchors, is in
`audit/deliverable-encryption-core.md` §5.

### 4.3 Backfill

The backfill is idempotent and **dry-run by default**. It never prints a PII
value — only counts and ids.

```bash
# See what would change. No writes.
npm run db:encrypt-backfill -- --dry-run

# One table at a time, so you can watch the counts.
npm run db:encrypt-backfill -- --dry-run --table=tenants
npm run db:encrypt-backfill -- --table=tenants

# Then the rest.
npm run db:encrypt-backfill
```

Expected output shape:

```
Scanned 1,284 rows in public.tenants
Encrypted  1,284 rows
Skipped        0 rows (already encrypted)
```

If the database is not configured the script exits 0 with a clear message
rather than failing the deploy.

### 4.4 After the backfill

- **Verify no plaintext remains:**
  ```sql
  SELECT count(*) FROM public.tenants
  WHERE national_id NOT LIKE 'v1:%';
  ```
  That must return `0` (after the call sites are converted, and after any
  legacy rows that are intentionally retained have been reviewed).
- **Verify the blind indexes work:** search for a tenant by email in the UI.
- **Keep a backup of the pre-backfill database.** There is no way back from
  encrypted rows without it.

---

## 5. Key rotation

The key registry is a map of key id → key, so rotation is additive.

1. **Add the new key alongside the old one.** Do not replace.
   ```bash
   PROPDESK_ENCRYPTION_KEYS='{"v1":"<old base64>","v2":"<new base64>"}'
   ```
2. **Deploy.** New writes use the newest key id. Old rows still decrypt under
   `v1` — `decryptFieldWithRotation()` handles this.
3. **Backfill.** The backfill re-encrypts any row that is not under the active
   key:
   ```bash
   npm run db:encrypt-backfill -- --dry-run
   npm run db:encrypt-backfill
   ```
4. **Verify** that no row is still encrypted under the old id.
5. **Only then remove the old key** — in a later deploy, after the backfill
   has been confirmed.

**Never** remove a key id while rows still use it. The failure mode is
permanent data loss, and the blind index key must be rotated with the same
care: a new blind index key means new index values, so the indexes must be
rebuilt, not just re-encrypted.

---

## 6. Storage: making the `documents` bucket private

This is an **owner-side action** in the Supabase dashboard. The SQL in
`supabase-setup/` sets the bucket private for fresh installs — and, because it
now uses `ON CONFLICT (id) DO UPDATE SET public = false`, re-running it also
flips an **existing** bucket to private.

Making the bucket private is a **breaking change for anyone holding an old
URL**. Follow the order exactly. The full rollout note is in
`audit/deliverable-storage-infra.md` §5.

### 6.1 Order of operations

**Step 0 — Deploy the code first, keep the bucket public.** The new code works
with a public bucket *and* a private one: the upload route stores the object
path (not a public URL) and every read goes through a signed URL. Nothing
breaks yet, and new uploads are already stored in the new format.

**Step 1 — Migrate the rows that still hold a public URL.**
`documents.file_url` and `property_photos.file_url` currently hold a public URL
for every pre-existing row. Convert them to the object path:

```sql
-- preview first
select id, file_url from documents where file_url like 'http%' limit 20;

update public.documents
   set file_url = split_part(file_url, '/storage/v1/object/public/documents/', 2)
 where file_url like '%/storage/v1/object/public/documents/%';

update public.property_photos
   set file_url = split_part(file_url, '/storage/v1/object/public/documents/', 2)
 where file_url like '%/storage/v1/object/public/documents/%';
```

Verify: `select count(*) from public.documents where file_url like 'http%';`
→ must be `0`. The API tolerates a legacy URL (it converts it on the fly), so a
missed row degrades to "the API can serve it, the client-side pages cannot".

**Step 2 — Fix the client-side pages that read the table directly in the
browser.** These three render `file_url` as a link or an image. After step 1
that value is a path, not a URL, so the link breaks until the page asks the API
for a signed URL:

- `app/dashboard/documents/page.tsx` (list — "View"/"Download")
- `app/dashboard/documents/[id]/page.tsx` (detail — "View"/"Download" + preview)
- `app/dashboard/properties/page.tsx` (cover photo in the property list)

Fix: call `GET /api/documents`, `GET /api/documents/[id]` and
`GET /api/properties/[id]/photos`, and use the `file_url` that comes back. The
response shape is unchanged — only the *value* of `file_url` is now a 5-minute
signed URL. This is the same work as CRYPTO-025 / PHASE 0 in §4.2.

**Step 3 — Flip the bucket to private.** Run the updated
`supabase-setup/01-create-tables.sql` (or just the bucket block) in the Supabase
SQL editor. **Existing public URLs stop working at this moment.** Any external
copy of a document link — an email, a WhatsApp message, a pasted invoice —
becomes a dead link. Warn support first.

Verify:
```sql
select id, name, public, file_size_limit, allowed_mime_types
  from storage.buckets where id = 'documents';    -- public must be false
select policyname, cmd from pg_policies
  where tablename = 'objects' and schemaname = 'storage';
```

**Step 4 — Confirm the RPC lockdown.**
```sql
select has_function_privilege('anon','public.bump_paybill_counters(uuid,boolean)','EXECUTE');         -- f
select has_function_privilege('authenticated','public.bump_paybill_counters(uuid,boolean)','EXECUTE'); -- f
select has_function_privilege('service_role','public.bump_paybill_counters(uuid,boolean)','EXECUTE'); -- t
select has_function_privilege('anon','public.prune_old_backups()','EXECUTE');                        -- f
select has_function_privilege('service_role','public.prune_old_backups()','EXECUTE');                -- t
```

Negative test from outside — it must return 401/403/404, never 200:
```bash
curl -X POST "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/rpc/bump_paybill_counters" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"p_paybill_id":"<any-uuid>","p_matched":true}'
```

**Step 5 — Sanity-check the paybill counters.** Any counter that was inflated
while `anon` could call the RPC is untrustworthy. Check
`paybills.matched_count`, `unmatched_count` and `last_payment_at` against
`c2b_transactions` and `reconciliation_audit`, and correct them by hand.

**Step 6 — Rotate the service-role key** if it has ever been exposed in a
client bundle or a log.

### 6.2 What to check afterwards

```bash
# An unauthenticated request for a document must NOT return the file
curl -s -o /dev/null -w "%{http_code}\n" \
  "https://<project>.supabase.co/storage/v1/object/public/documents/<path>"
# -> 400 or 404, never 200
```

Then, as the owner in the dashboard: the document list shows signed links that
expire in five minutes, and the property gallery shows photos.

---

## 7. M-Pesa production checklist

The M-Pesa path was the source of several HIGH findings. Verify each one.

- [ ] `MPESA_ENV=production` — set explicitly, never left unset.
- [ ] `MPESA_SANDBOX_MOCK` is unset. The mock path is only reachable when
      `MPESA_ENV` is explicitly `sandbox` **and** `NODE_ENV` is not
      `production`. Both conditions must hold.
- [ ] `MPESA_ALLOWED_CALLBACK_IPS` lists Safaricom's real callback IPs. An
      **unset or empty** allowlist rejects the callback. This is fail-closed on
      purpose — if callbacks stop arriving after you set it, check the list
      before you disable it.
- [ ] `MPESA_CALLBACK_SECRET` is set (recommended). It is accepted as a second
      factor alongside the IP allowlist.
- [ ] A callback whose settled amount does **not** match the invoice does not
      mark the invoice paid. Test with a deliberately wrong amount.
- [ ] A forged `X-Forwarded-For` header alone does not satisfy the allowlist.
      The trusted platform header is used instead.

**Live smoke test before launch:** run one real KES 1 payment end to end —
STK push, callback, invoice marked paid, receipt visible in the dashboard — and
confirm the amount check rejects a mismatched amount.

---

## 8. Deployment and rollback

### 8.1 Deployment order

1. Apply the database migrations (§3). Migrations are additive and idempotent,
   so they are safe to apply before the code.
2. Deploy the application.
3. Apply the storage bucket flip (§6.1).
4. Run the encryption backfill (§4.3).

### 8.2 Rollback

The code can be rolled back with the usual deployment revert. **The database
cannot**, in one specific situation:

> If the encryption backfill has run, rolling the code back to a version that
> reads plaintext will show ciphertext in the UI. The read path passes
> plaintext through, but a version from before the encryption work was written
> will display the raw envelope.

Before the backfill, take a database snapshot and keep it until the encryption
change has been running cleanly for at least one week.

### 8.3 What must never be rolled back

- `005-encryption.sql` — additive only, no data loss, no reason to roll back.
- The `documents` bucket flip — rolling it back re-exposes tenant identity
  documents. If something breaks after the flip, fix the serving code; do not
  make the bucket public again.

---

## 9. CI checks

The following must pass on every pull request. Add them to the pipeline before
launch.

```bash
# 1. Type check — must not exceed the baseline error count
npx tsc --noEmit

# 2. Tests
npm test          # 146 tests across 6 files, all green

# 3. Dependency audit — must be clear of CRITICAL
npm audit --audit-level=critical

# 4. Build — must fail on a type error
npm run build

# 5. No secret committed
git diff --cached | grep -nE "(sk_live|sk_test|service_role|BEGIN (RSA|OPENSSH|PRIVATE)|password\s*=\s*['\"][^'\"]+)"
```

The type check currently reports 52 errors against a baseline of 54. **Do not
raise that number.** The remaining errors are all in the files listed in
`audit/baseline/tsc-baseline.log`; fixing them is worth doing, but it is not a
launch blocker.

---

## 10. Residual risks to keep on the list

These are not bugs to fix before launch. They are risks to keep watching.

| Risk | Why it stays | Mitigation |
|---|---|---|
| Rate limiting is per-instance and in-memory | A serverless instance is reset on every cold start, and a multi-instance deployment gets N times the limit | Move to a shared store (Upstash, or a table in Neon) before you scale past one instance |
| Tenancy is application-level, not RLS | The Neon database has no row-level security; every query must add its own `user_id` scope | Run the unscoped-query audit (§11) and keep it in CI |
| Two databases | Supabase Postgres (auth + storage) and Neon Postgres (data) are separate systems with separate failure modes | Both need monitoring; the health probe only covers Neon |
| Legacy plaintext rows | Until the backfill runs, national IDs and phone numbers sit in the database unencrypted | §4 |
| `npm audit` HIGH on `zod` | The fix is a major upgrade (4.6.7) that changes the API | A deliberate upgrade pass, not a drive-by bump |
| `throwUnlessMissingTable` swallows errors | A missing table is reported as "no rows", which hides broken features | Prefer an explicit migration; check the feature list before launch |
| One HIGH dependency advisory remains | `zod` < 4.6.6 — memory exhaustion on an oversized constrained collection. The fix is 4.6.7, a breaking major upgrade | A deliberate upgrade pass over every `zod` schema, not a drive-by bump |
| The Next.js `middleware` convention is deprecated | Next 16.4.3 warns that `middleware.ts` should become `proxy.ts`. Nothing breaks today | Run `npx @next/codemod@canary middleware-to-proxy .` in a separate, tested change |
| The CSP is report-only | An enforcing policy needs a per-request nonce, which is a middleware change | Walk the app with the report-only header, then switch — the procedure is in the storage deliverable §6 |
| No COOP / CORP headers | `Cross-Origin-Opener-Policy: same-origin` can break the Supabase/Google OAuth popup flow, and `Cross-Origin-Resource-Policy` needs per-route thought because images are served from Supabase | Decide per route once the OAuth flow is confirmed working |
| Three dashboard pages still read `documents` / `property_photos` directly | They render `file_url` as a link, and it is now a path rather than a URL | Fix them as part of the storage rollout — runbook §6, step 2 |
| Paybill counters may be inflated | While the RPC was executable by `anon`, anyone could bump them | Sanity-check against `c2b_transactions` and `reconciliation_audit` — runbook §6, step 5 |

---

## 11. The unscoped-query audit

Because tenancy is enforced in application code, a query that forgets its
`user_id` scope is a cross-tenant data leak. This is the single most dangerous
class of bug in this codebase, and it is not caught by the type checker.

Run this before launch and after every change to a data-reading route:

```bash
# Find every database read in app/api and check that it has a user_id scope
grep -rn "\.from(" app/api --include=*.ts -A 4 \
  | grep -B 1 "\.select(" \
  | grep -v "user_id" \
  | grep -v "^--"
```

Every hit needs a manual look. A legitimate hit is a table with no user
dimension (a lookup table, a counter). A hit on `tenants`, `properties`,
`payments`, `documents`, `notes`, `maintenance_requests`, `damages` or
`quotations` is a leak.

The same applies to the Supabase browser client: the dashboard pages read
sensitive columns directly from the browser today (see `FEAT-012`), which also
blocks the encryption rollout.

---

## 12. Incident response, briefly

If something looks wrong in production:

1. **Rotate the exposed secret first.** `MIGRATION_SECRET`, `CRON_SECRET`,
   `BACKUP_CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`,
   `MPESA_CONSUMER_SECRET`, `MPESA_SECURITY_CREDENTIAL` — rotate in the
   provider's dashboard, then update the deployment. Do not debug first.
2. **Check the logs** for the route context passed to `dbError()` — the raw
   database error is recorded server-side.
3. **For a suspected backup exfiltration**, check the audit trail in the
   `audit_logs` table and the access log in the Supabase dashboard.
4. **For a suspected M-Pesa payment fraud**, every callback is recorded in
   `c2b_transactions` with its raw payload. Check for callbacks arriving from
   an IP that is not in `MPESA_ALLOWED_CALLBACK_IPS`.
5. **For a suspected data leak**, `tenants.national_id` and `c2b_transactions.msisdn`
   are the highest-value targets. If you believe either was exposed, rotate
   `SUPABASE_SERVICE_ROLE_KEY` and assume the values are compromised.
