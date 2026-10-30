# PropDesk Africa — Encryption, Key Management & Data-Protection Findings

**Task:** `audit-crypto` · **Track:** read-only design · **Date:** 2026-10-26
**Scope:** encryption at rest, key management, secret handling, storage protection, retention/deletion, audit logging.

**Method.** Read `db/migrations/001-core.sql`, `db/migrations/002-support.sql`, the `supabase-setup/*.sql` patch set
(shipped via `PATCH_LOG`, `lib/system.ts:80-100`), every route in `app/api/**`, the helpers in `lib/**`, the
legal pages in `app/(marketing)/legal/**` and the help centre. Every finding below cites a `file:line` that
resolves in the repository as of this commit.

**Two database paths exist and the distinction matters for every finding:**

| Path | When it is used | Isolation mechanism |
|---|---|---|
| **Neon Postgres** (primary) | `DATABASE_URL` set — `lib/db/neon.ts:23-42` | **Application-layer `.eq("user_id", userId)` only. No RLS.** `db/migrations/001-core.sql:9-13`, `lib/api/with-db-auth.ts:14-15` |
| **Supabase Postgres** (legacy fallback) | `DATABASE_URL` absent | Postgres RLS policies in `supabase-setup/*.sql` |

---

## 1. Data inventory

Classes: **public** · **internal** · **PII** · **sensitive PII** (government identifiers, identity documents) ·
**financial** (amounts, account/receipt identifiers) · **credential**.
"Plaintext" = the value is stored as-is in a `text`/`jsonb` column with no application-layer encryption.
"Scoped" = the read path filters by the authenticated `user_id`.

### 1.1 `app_users` — `db/migrations/001-core.sql:22-29`

| Column | Class | Plaintext? | Scoped? | Note |
|---|---|---|---|---|
| `id` | internal | n/a | yes | PK, mirrors `auth.users.id` |
| `email` | PII | **yes** | yes | Landlord's login email; also `auth.users.email` |
| `full_name` | PII | **yes** | yes | |

### 1.2 `user_profiles` — `db/migrations/001-core.sql:31-47`

| Column | Class | Plaintext? | Scoped? | Note |
|---|---|---|---|---|
| `user_id` | internal | n/a | yes | PK |
| `full_name`, `first_name`, `last_name` | PII | **yes** | yes | |
| `company_name` | internal | **yes** | yes | |
| `phone` | PII | **yes** | yes | Landlord's own phone |
| `address`, `city`, `county` | PII | **yes** | yes | Physical address |
| `avatar_url` | internal | **yes** | yes | Storage URL |
| `notification_preferences` | internal | **yes** | yes | jsonb |

### 1.3 `properties` — `db/migrations/001-core.sql:49-73`

| Column | Class | Plaintext? | Scoped? | Note |
|---|---|---|---|---|
| `id`, `user_id`, `property_id` refs | internal | n/a | yes | |
| `name` | internal | **yes** | yes | |
| `address`, `city`, `county` | PII | **yes** | yes | Landlord's asset address; sensitive if the landlord lives there |
| `type`, `bedrooms`, `bathrooms`, `size_sqft`, `square_feet` | public | **yes** | yes | |
| `rent_amount`, `monthly_rent`, `deposit_amount` | financial | **yes** | yes | |
| `description`, `amenities` | public/internal | **yes** | yes | |

### 1.4 `tenants` — `db/migrations/001-core.sql:76-94` (Supabase path adds `emergency_contact_*`, `supabase-setup/01-create-tables.sql:64-65`)

| Column | Class | Plaintext? | Scoped? | Note |
|---|---|---|---|---|
| `id`, `user_id` | internal | n/a | yes | |
| `full_name`, `first_name`, `last_name` | PII | **yes** | yes | |
| `email` | PII | **yes** | yes | |
| `phone` | **PII** | **yes** | yes | **Read by a public, unscoped query — see CRYPTO-002** |
| `national_id` | **sensitive PII** | **yes** | yes | **Kenyan national ID — the highest-value field in the schema** |
| `emergency_contact_name`, `emergency_contact_phone` | PII (third party) | **yes** | yes | **Supabase path only — the Neon migration lacks these columns entirely** while `app/api/tenants/route.ts:67-68` still writes them |
| `property_id` | internal | n/a | yes | FK `on delete set null` |
| `lease_start_date`, `lease_end_date` | financial | **yes** | yes | |
| `monthly_rent`, `deposit_amount` | financial | **yes** | yes | |
| `status` | internal | **yes** | yes | |
| `notes` | PII (free text) | **yes** | yes | Landlords paste ID numbers here |

### 1.5 `rent_payments` — `db/migrations/001-core.sql:96-121`

| Column | Class | Plaintext? | Scoped? | Note |
|---|---|---|---|---|
| `user_id`, `tenant_id`, `property_id` | internal | n/a | yes | `tenant_id` FK `on delete cascade` |
| `amount`, `late_fee` | financial | **yes** | yes | |
| `due_date`, `paid_date` | financial | **yes** | yes | |
| `payment_method` | financial | **yes** | yes | `mpesa` / `bank_transfer` / `cheque` |
| `reference_number` | **financial** (M-Pesa receipt / bank reference) | **yes** | yes | |
| `notes` | PII / financial (free text) | **yes** | yes | Auto-written by the C2B engine — `app/api/mpesa/c2b/confirmation/route.ts:191` |

### 1.6 `expenses` — `db/migrations/001-core.sql:123-139`

| Column | Class | Plaintext? | Scoped? | Note |
|---|---|---|---|---|
| `amount`, `category`, `expense_date` | financial | **yes** | yes | |
| `description`, `notes` | financial / PII (free text) | **yes** | yes | |
| `vendor` | PII (third party) | **yes** | yes | |
| `receipt_url` | internal | **yes** | yes | Storage URL, same bucket as documents |

### 1.7 `maintenance_requests` — `db/migrations/001-core.sql:141-165`

| Column | Class | Plaintext? | Scoped? | Note |
|---|---|---|---|---|
| `title`, `description`, `category` | internal | **yes** | yes | |
| `contractor_name` | PII (third party) | **yes** | yes | |
| `contractor_phone` | PII (third party) | **yes** | yes | |
| `estimated_cost`, `actual_cost` | financial | **yes** | yes | |
| `scheduled_date`, `completed_date`, `priority`, `status` | internal | **yes** | yes | |
| `notes` | PII (free text) | **yes** | yes | |

### 1.8 `notes` — `db/migrations/001-core.sql:167-181`

| Column | Class | Plaintext? | Scoped? | Note |
|---|---|---|---|---|
| `title`, `content` | PII (free text) | **yes** | yes | Free-form; may contain ID numbers |
| `category`, `priority`, `is_pinned` | internal | **yes** | yes | |

### 1.9 `documents` — `db/migrations/001-core.sql:183-202` — **identity documents**

| Column | Class | Plaintext? | Scoped? | Note |
|---|---|---|---|---|
| `name` | **PII** (identity-document filename, e.g. `Passport-Jane-Kimani.pdf`) | **yes** | yes | Leaks identity through the filename alone |
| `type`, `category` | internal | **yes** | yes | |
| `file_url` | **sensitive PII** (public URL to the file) | **yes** | yes | **Bucket is public — see CRYPTO-005** |
| `file_size`, `mime_type` | internal | **yes** | yes | |
| `notes` | PII (free text) | **yes** | yes | |
| `property_id`, `tenant_id`, `expiry_date`, `reminder_days_before` | internal | **yes** | yes | `tenant_id` FK `on delete set null` — row survives tenant deletion |

### 1.10 `notifications` — `db/migrations/002-support.sql:7-24`

| Column | Class | Plaintext? | Scoped? | Note |
|---|---|---|---|---|
| `title`, `message` | PII | **yes** | yes | **Embeds the tenant's full name** — `db/migrations/002-support.sql:35-46` interpolates `rec.full_name` into the title and message |
| `type`, `severity`, `link`, `is_read` | internal | **yes** | yes | |
| `metadata` (jsonb) | internal | **yes** | yes | Contains ids and dates, not names |

### 1.11 `property_photos` — `db/migrations/002-support.sql:255-269`

| Column | Class | Plaintext? | Scoped? | Note |
|---|---|---|---|---|
| `file_url` | PII (property imagery → address disclosure) | **yes** | yes | **Public bucket, service-role upload — see CRYPTO-006** |
| `caption` | PII-ish | **yes** | yes | |
| `property_id`, `user_id`, `display_order`, `is_cover` | internal | **yes** | yes | |

### 1.12 `tenant_users` — `db/migrations/002-support.sql:280-288`

| Column | Class | Plaintext? | Scoped? | Note |
|---|---|---|---|---|
| `user_id`, `tenant_id`, `invited_by` | internal | n/a | yes | Tenant-portal link; `app/api/tenants/[id]/invite/route.ts:46-57` |
| `invited_at`, `accepted_at` | internal | n/a | yes | |

### 1.13 `mpesa_transactions` — `db/migrations/002-support.sql:290-311`

| Column | Class | Plaintext? | Scoped? | Note |
|---|---|---|---|---|
| `phone` | **PII** (MSISDN) | **yes** | yes | Written verbatim at `app/api/mpesa/stkpush/route.ts:69` |
| `amount` | financial | **yes** | yes | |
| `merchant_request_id`, `checkout_request_id`, `mpesa_receipt` | financial identifier | **yes** | yes | |
| `result_code`, `result_desc`, `transaction_date`, `status` | internal/financial | **yes** | yes | |
| `raw_response` (jsonb) | **PII** | **yes** | yes | Full Daraja response |
| `raw_callback` (jsonb) | **PII** | **yes** | yes | Full Daraja callback incl. `CallbackMetadata.PhoneNumber` — `app/api/mpesa/callback/route.ts:76` |

### 1.14 `paybills` — `supabase-setup/10-holy-grail.sql:48-64`

| Column | Class | Plaintext? | Scoped? | Note |
|---|---|---|---|---|
| `number` | **financial identifier** (Safaricom paybill / till) | **yes** | yes | |
| `label`, `type`, `active` | internal | **yes** | yes | |
| `c2b_validation_url`, `c2b_confirmation_url` | internal | **yes** | yes | |
| `matched_count`, `unmatched_count`, `last_payment_at` | internal | **yes** | yes | |

### 1.15 `c2b_transactions` — `supabase-setup/10-holy-grail.sql:90-116`

| Column | Class | Plaintext? | Scoped? | Note |
|---|---|---|---|---|
| `msisdn` | **PII** | **yes** | yes | Payer's phone; **no FK to `tenants`** — survives tenant deletion |
| `first_name`, `middle_name`, `last_name` | **PII** | **yes** | yes | Payer's legal name |
| `trans_id`, `bill_ref_number`, `invoice_number`, `third_party_trans_id` | financial identifier | **yes** | yes | |
| `trans_amount`, `trans_time`, `business_short_code` | financial | **yes** | yes | |
| `raw` (jsonb) | **PII** | **yes** | yes | **Whole Daraja payload — `app/api/mpesa/c2b/confirmation/route.ts:174`** |
| `matched_tenant_id`, `match_method`, `match_confidence`, `match_status` | internal | **yes** | yes | `matched_tenant_id` FK `on delete set null` |

### 1.16 `contacts` — `supabase-setup/10-holy-grail.sql:327-341`

| Column | Class | Plaintext? | Scoped? | Note |
|---|---|---|---|---|
| `name` | PII | **yes** | yes | |
| `email`, `phone` | PII | **yes** | yes | **Same class as `tenants.phone` — a first-class PII table, in `BACKUP_TABLES`** |
| `company`, `notes` | PII | **yes** | yes | |
| `role`, `tags`, `properties`, `last_contact_at` | internal | **yes** | yes | |

### 1.17 `managed_landlords` / `team_members` / `companies` — `supabase-setup/10-holy-grail.sql:173-228`, `140-151`

| Column | Class | Plaintext? | Scoped? | Note |
|---|---|---|---|---|
| `managed_landlords.contact_email`, `contact_phone` | PII | **yes** | yes | Landlord's contact details, held by a company/agency |
| `team_members.name`, `email` | PII | **yes** | yes | Staff PII |
| `companies.name`, `address`, `phone` | PII / business | **yes** | yes | |

### 1.18 `reconciliation_audit` — `supabase-setup/10-holy-grail.sql:389-400`

| Column | Class | Plaintext? | Scoped? | Note |
|---|---|---|---|---|
| `decision`, `confidence`, `rule_id` | internal | **yes** | yes | |
| `matched_tenant_id`, `matched_payment_id` | internal | **yes** | yes | `on delete set null` |
| `notes` | internal / PII-ish | **yes** | yes | Reconciliation commentary |

### 1.19 `backups` — `supabase-setup/11-backup-patch.sql:62-80`

| Column | Class | Plaintext? | Scoped? | Note |
|---|---|---|---|---|
| `payload` (jsonb) | **full PII replica** | **yes** | yes | **Every row of 19 tables verbatim, including `tenants.national_id` — see CRYPTO-014** |
| `storage_path` | internal | **yes** | yes | Points at a plaintext `.json` file in the `backups` bucket |
| `label`, `kind`, `format`, `size_bytes`, `row_count`, `storage_kind`, `source`, `metadata` | internal | **yes** | yes | `metadata.counts` is per-table row counts, not PII |

### 1.20 Credentials — **not stored in these tables**

| Secret | Where it lives | Handling |
|---|---|---|
| User password | Supabase Auth (`auth.users`), never in Neon | `lib/actions.ts:26-29` `signInWithPassword`; `lib/actions.ts:70-76` `signUp`; `app/(marketing)/auth/reset-password/form.tsx:57` `updateUser` — **the app never hashes or stores a password** |
| Session / refresh token | Supabase Auth cookie | `lib/supabase/server.ts:33-53` |
| OTP / verification code | **not stored by the app** | No OTP table, no code column, no code comparison anywhere. `components/ui/input-otp.tsx` is a shadcn input component with no backend counterpart. Email verification and password reset are entirely Supabase Auth (`lib/actions.ts:70-76`, `app/(marketing)/auth/forgot-password/action.ts:12-14`) |
| `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY` | env only | `lib/mpesa/daraja.ts:52-53` — sent to Safaricom, never persisted |
| `STRIPE_SECRET_KEY` | env only | `lib/stripe.ts:7-9` |
| `SUPABASE_SERVICE_ROLE_KEY` | env only | `lib/supabase/service.ts:17` — bypasses RLS, used in `app/api/mpesa/callback/route.ts:67`, `app/api/stripe/webhook/route.ts:21`, `app/api/properties/[id]/photos/route.ts:62` |
| `CRON_SECRET`, `MIGRATION_SECRET`, `BACKUP_CRON_SECRET`, `MPESA_CALLBACK_SECRET` | env only | Compared with `===` / `!==` — see CRYPTO-008/009/010/011 |

---

## 2. Findings

### CRYPTO-001 — Tenant national ID numbers are stored in plaintext
* **Severity:** CRITICAL · **Category:** `plaintext-pii`
* **Location:** `db/migrations/001-core.sql:84` · `app/api/tenants/route.ts:65` · `app/api/tenants/[id]/route.ts:57`
* **Evidence:** The column is declared `national_id text` and the API writes the value through untouched:
  `national_id: blankToNull(fields.national_id) || blankToNull(fields.id_number)`.
* **Impact:** A Kenyan national ID is a state-issued identity document number. It is the single highest-value
  field in the schema: it is sufficient for identity fraud and it is special-category-adjacent personal data
  under the Data Protection Act 2019. Every path that can read the table — a leaked `DATABASE_URL`, a Neon
  console share, a read-only role, the `backups.payload` snapshot (§1.19) or the CSV export — yields it in
  clear text for every customer of the platform. There is no field-level control at all today.
* **Fix:** Encrypt `tenants.national_id` with AES-256-GCM (randomised mode) using the envelope and key
  registry in `audit/design/encryption-design.md` §3. No blind index is needed — national IDs are never
  searched, only displayed. Add `tenants.national_id_enc` as a new column rather than repurposing `national_id`
  so the read path can be migrated with a decrypt-then-migrate fallback.

### CRYPTO-002 — Tenant phone numbers are stored in plaintext and matched by an unscoped public query
* **Severity:** HIGH · **Category:** `plaintext-pii`
* **Location:** `db/migrations/001-core.sql:83` · `app/api/mpesa/c2b/validation/route.ts:75-80`
* **Evidence:**
  ```sql
  select id from public.tenants
  where phone = ${phone}
     or phone like ${"%" + phone.slice(-9)}
  limit 1
  ```
  This runs on the **public** M-Pesa C2B validation endpoint (`app/api/mpesa/c2b/validation/route.ts:32-35`,
  no auth) and filters by **no tenant at all** — it scans every landlord's tenants on the platform.
* **Impact:** Two problems. (a) The phone number of every tenant in the platform is plaintext and
  cross-queryable by an unauthenticated caller; the endpoint returns only a boolean, but it is an oracle
  over the whole tenant base. (b) The query is an unindexed `LIKE '%…'` scan, so it leaks table cardinality
  and row position through latency. Critically for the implementation track: **this query breaks the moment
  `phone` is encrypted**, so the design must ship a blind index or this endpoint silently stops matching
  tenants.
* **Fix:** Encrypt `tenants.phone` (randomised) and add a blind-index column `tenants.phone_bidx`
  (HMAC-SHA256 over the normalised E.164 number, separate key). Rewrite the lookup as
  `where phone_bidx = ${blindIndex(normalizePhone(msisdn))} and user_id = ${ownerUserId}` — the owner is
  already known from the paybill short code (`app/api/mpesa/c2b/confirmation/route.ts:98-117`), so the
  cross-tenant scan disappears as well.

### CRYPTO-003 — M-Pesa payer identity (MSISDN + legal name) is stored in plaintext outside any tenant FK
* **Severity:** HIGH · **Category:** `plaintext-pii`
* **Location:** `db/migrations/002-support.sql:295` · `supabase-setup/10-holy-grail.sql:104-107` ·
  `app/api/mpesa/stkpush/route.ts:69` · `app/api/mpesa/c2b/confirmation/route.ts:172`
* **Evidence:** `mpesa_transactions.phone text not null`; `c2b_transactions` carries `msisdn`, `first_name`,
  `middle_name`, `last_name` with **no foreign key to `tenants`** (`supabase-setup/10-holy-grail.sql:90-116`).
  The values come straight off the Daraja callback.
* **Impact:** The payer's phone number and legal name are persisted in clear text, in tables that are not
  bound to a tenant record. When a landlord deletes a tenant, these rows survive untouched — so the
  "offboarding" flow leaves the payer's identity behind forever, directly contradicting the deletion
  promise on the privacy page. Because the payer name is a natural person and not the landlord, PropDesk is
  also holding personal data about a third party (the tenant) that it has no retention basis for.
* **Fix:** Encrypt `mpesa_transactions.phone`, `c2b_transactions.msisdn` and the three name columns
  (randomised). On tenant offboarding, redact (not merely orphan) these values. See
  `audit/design/encryption-design.md` §6.

### CRYPTO-004 — Raw Daraja payloads are persisted as plaintext jsonb, duplicating the PII the column plan would protect
* **Severity:** HIGH · **Category:** `plaintext-pii`
* **Location:** `app/api/mpesa/callback/route.ts:76` · `app/api/mpesa/c2b/confirmation/route.ts:174` ·
  `db/migrations/002-support.sql:305-306`
* **Evidence:** `raw_callback: body` and `raw = ${JSON.stringify(body)}` write the *entire* Daraja payload,
  which contains `CallbackMetadata.PhoneNumber`, `MpesaReceiptNumber`, `FirstName`/`LastName` and the
  account reference.
* **Impact:** Any encryption plan that covers `msisdn` but not `raw` is defeated: the same phone number and
  payer name sit in clear text one column over. A `select *` on either table — which every "dump the data"
  incident response does — leaks the full PII set regardless of the rest of the plan. This is the most likely
  way an implementation of the design is silently broken.
* **Fix:** Replace `raw_callback` / `raw` with a **whitelisted** subset (`TransID`, `TransTime`,
  `TransAmount`, `BusinessShortCode`, `BillRefNumber`, `MpesaReceiptNumber`, `ResultCode`) and drop the rest
  before the insert; store the discarded remainder nowhere. If the full payload must be kept for
  reconciliation disputes, encrypt the whole jsonb blob with the envelope format instead.

### CRYPTO-005 — The `documents` storage bucket is PUBLIC; RLS does not protect it
* **Severity:** CRITICAL · **Category:** `missing-storage-policy`
* **Location:** `supabase-setup/01-create-tables.sql:326-328` and `:353-355` ·
  `supabase-setup/02-add-missing-columns.sql:65-67` · `app/api/documents/upload/route.ts:48` ·
  `app/api/documents/[id]/route.ts:103-112`
* **Evidence:**
  ```sql
  INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true)
  ...
  -- The bucket is public-readable so the app can render the URL directly
  -- without a signed-URL round-trip. Files are still scoped per-user via
  -- the path prefix (userId/...) enforced by the policies above.
  ```
  and `app/api/documents/upload/route.ts:48` → `supabase.storage.from("documents").getPublicUrl(path)`.
* **Impact:** **A public Supabase bucket bypasses RLS entirely for reads.** The four
  `storage.objects` policies at `supabase-setup/01-create-tables.sql:336-351` are inert for reads, and the
  comment claiming the files are "still scoped per-user via the path prefix" is wrong — a public object URL
  is readable by anyone who holds it, with no session, no expiry and no revocation. The bucket holds
  national ID scans, passports, lease agreements and identity documents. The URL is persisted in
  `documents.file_url`, returned by `/api/export` (`app/api/export/route.ts:27`) and by
  `/api/backup/csv/[table]`, and pasted into e-mail and WhatsApp by landlords. One leaked link = permanent
  public access to a tenant's identity document, with no access log. The file path prefix
  (`${userId}/…`, `app/api/documents/upload/route.ts:30`) is a *guessing* barrier only, and `userId` is a
  UUID that appears in other URLs.
* **Fix:**
  1. `update storage.buckets set public = false where id = 'documents';`
  2. Replace `getPublicUrl` with `createSignedUrl(path, 300)` at upload time and a signed-URL endpoint for
     reads; store the *path* in `documents.file_url`/`documents.storage_path`, not the public URL.
  3. Add a bucket policy that allows a signed-in user to read only objects under their own prefix, and keep
     uploads under the authenticated client rather than the service role.

### CRYPTO-006 — Property photos bypass the storage path policy and land in the same public bucket
* **Severity:** HIGH · **Category:** `missing-storage-policy`
* **Location:** `app/api/properties/[id]/photos/route.ts:57`, `:59-70`, `:96` ·
  `supabase-setup/01-create-tables.sql:340-342`
* **Evidence:**
  ```ts
  const path = `property-photos/${userId}/${params.id}/${randomUUID()}.${ext}`   // :57
  const storageClient = serviceKey && url
    ? createServiceClient(url, serviceKey, { auth: { persistSession: false } })    // :61-63
    : supabase
  const { data: pub } = storageClient.storage.from("documents").getPublicUrl(path)  // :70
  ```
  The RLS policy is `auth.uid()::text = (storage.foldername(name))[1]`, i.e. it expects the **first path
  segment to be the user id**. Here the first segment is the literal `property-photos`, so the policy would
  reject the upload — the route only succeeds because the service-role client bypasses RLS entirely.
* **Impact:** Two compounding problems: (a) the ownership check that the policy was supposed to perform is
  not performed at all — the service key writes anywhere; (b) the resulting URL is permanent and public.
  Property photos are the strongest physical-security signal in the dataset: a photo of the gate, the
  water tank or the compound plus the `properties.address` identifies the landlord's home, and combined with
  the tenant list it identifies the landlord's tenants.
* **Fix:** Create a **separate private bucket** `property-photos` (`public = false`), change the path to
  `${userId}/${propertyId}/${uuid}.${ext}` so it satisfies the folder-prefix policy, upload with the
  *authenticated* client (drop the service-role branch at `:61-63`), and serve via short-lived signed URLs.

### CRYPTO-007 — There is no application-layer encryption, no key material and no key registry
* **Severity:** CRITICAL · **Category:** `key-management`
* **Location:** `lib/db/neon.ts:36-42` · the whole repository (no `lib/crypto/`, no
  `PROPDESK_ENCRYPTION_KEY` reference anywhere)
* **Evidence:** `getDb()` opens a Neon HTTP connection and every column in §1 is stored as plain text. There
  is no envelope format, no key id, no rotation support and no key-management code path in the repo.
* **Impact:** The Neon connection string is the only control between an attacker and every landlord's tenant
  PII. A leaked `DATABASE_URL` (Vercel env var, `.env` on a laptop, a Neon branch share, a `sql.unsafe`
  injection) yields plaintext national IDs, phone numbers and M-Pesa records for every customer. The
  published security page already tells the market the product is "AES-256 at rest"
  (`app/(marketing)/security/page.tsx:16`) — a claim that is only true of the *infrastructure provider's*
  disk, not of the application's data. A shared key is also a single point of compromise for the whole
  platform: one leaked key exposes every tenant of every landlord.
* **Fix:** Implement `lib/crypto/field-encryption.ts` exactly as specified in
  `audit/design/encryption-design.md` §3, with a key registry loaded from `PROPDESK_ENCRYPTION_KEYS` and
  per-tenant data-encryption keys wrapped by a master key (§8 of the design), so that a single key
  compromise is bounded.

### CRYPTO-008 — `CRON_SECRET` is compared with `!==`
* **Severity:** MEDIUM · **Category:** `weak-compare`
* **Location:** `app/api/cron/run/route.ts:22-32`
* **Evidence:**
  ```ts
  const got = auth.replace(/^Bearer\s+/i, "").trim()
  if (got !== secret) { return errorResponse("Forbidden: missing or invalid CRON_SECRET", 403) }
  ```
* **Impact:** A non-constant-time string comparison short-circuits on the first differing byte, so the
  response time varies with how many leading characters of the guess are correct. A remote attacker can
  recover the secret incrementally. Secondary issue in the same block: when `CRON_SECRET` is unset the
  endpoint is **fully open** (`app/api/cron/run/route.ts:23-25` only blocks the unset case in
  `production`), and the endpoint is a public POST that can be triggered by anyone who finds the URL.
* **Fix:** Compare `sha256(got)` against `sha256(expected)` with `crypto.timingSafeEqual` (fixed 32-byte
  digests — no length oracle, no `timingSafeEqual` throw risk). Fail closed in **all** environments.

### CRYPTO-009 — `MIGRATION_SECRET` is compared with `===` on three routes that can execute SQL
* **Severity:** MEDIUM · **Category:** `weak-compare`
* **Location:** `app/api/migrations/run/route.ts:49` · `app/api/migrations/reset/route.ts:44` ·
  `app/api/migrations/rollback/route.ts:35`
* **Evidence:** `if (expected && got === expected) return null` (run) and
  `if (expected && got === expected) return null` (reset) / `if (expected && got === expected) return null`
  (rollback).
* **Impact:** The same timing leak, but the blast radius is far larger: `MIGRATION_SECRET` authorises
  `app/api/migrations/run/route.ts:117` to run `sql.unsafe(sqlText)` — arbitrary SQL against the live
  production database — and `app/api/migrations/rollback/route.ts:80` to run rollback SQL. A recovered
  secret is full database control, including the ability to read or exfiltrate every encrypted field.
* **Fix:** Timing-safe digest comparison as in CRYPTO-008. Rotate the secret after the deployment window
  and consider restricting these three routes to a Vercel deployment-protection header in addition.

### CRYPTO-010 — `BACKUP_CRON_SECRET` is compared with `===`, and the endpoint is open when it is unset
* **Severity:** MEDIUM · **Category:** `weak-compare`
* **Location:** `app/api/backup/auto/route.ts:26-39`
* **Evidence:**
  ```ts
  if (!expected) {
    if (process.env.NODE_ENV === "production") { …503… }
    return null // dev only                       // :35
  }
  const got = request.headers.get("x-cron-secret") ?? …
  return got === expected ? null : NextResponse.json({ error: "Forbidden" }, { status: 403 })  // :38
  ```
* **Impact:** In every non-production environment the endpoint is unauthenticated, and it is a **bulk
  data-exfiltration primitive**: it enumerates every user with `auto_backup = true`
  (`app/api/backup/auto/route.ts:54`) and writes a full plaintext snapshot of their data
  (`app/api/backup/auto/route.ts:95-110`). The comparison itself also leaks.
* **Fix:** Timing-safe digest comparison; require the secret unconditionally in every environment; scope
  the enumeration to a single explicit `user_id` per call.

### CRYPTO-011 — The M-Pesa callback secret check is timing-safe but leaks the secret's length
* **Severity:** LOW · **Category:** `weak-compare`
* **Location:** `app/api/mpesa/callback/route.ts:34`
* **Evidence:**
  ```ts
  if (!providedSecret || providedSecret.length !== callbackSecret.length ||
      !timingSafeEqual(Buffer.from(providedSecret), Buffer.from(callbackSecret))) { …403… }
  ```
* **Impact:** This is the **only** secret comparison in the codebase that uses `timingSafeEqual`, and the
  equal-length guard is present and correct — good. Two residual issues: (a) the guard compares UTF-16
  code-unit counts (`.length`) while `timingSafeEqual` compares **byte** lengths, so for a secret containing
  a multi-byte character the two quantities diverge; (b) the guard is a length oracle — an attacker learns
  the exact secret length from the response before guessing the bytes. On a public endpoint this is
  free reconnaissance.
* **Fix:** Hash both sides first and compare fixed-length digests:
  `timingSafeEqual(sha256(provided), sha256(expected))`. This removes the length oracle, the
  unicode/byte mismatch, and the "throws on unequal length" hazard in one move. Apply the same helper to
  CRYPTO-008/009/010.

### CRYPTO-012 — No account-deletion path exists, although the privacy policy and help centre both promise one
* **Severity:** HIGH · **Category:** `retention-gap`
* **Location:** `app/(marketing)/legal/privacy/page.tsx:67-73` ·
  `app/(marketing)/help/page.tsx:71-72` · `app/dashboard/settings/page.tsx:370-437` ·
  `lib/actions.ts:109-117`
* **Evidence:** The privacy policy states: *"You can export, correct or delete your data at any time from
  Settings → Data."* The help centre states: *"Yes — Settings → Data → Delete account. We delete within 30
  days, except records we're legally required to keep."* The Settings → Data tab renders **only** an
  "Export Data" card with two download links (`app/dashboard/settings/page.tsx:370`, `:411`, `:419`) — there
  is no delete control anywhere in the application. There is no `DELETE /api/account` route, no
  `supabase.auth.admin.deleteUser()` call and no `auth.users` delete in `app/api/**` or `lib/**`. The only
  session-ending path is `signOut` (`lib/actions.ts:109-117`), which deletes nothing.
* **Impact:** This is a **provable, published false statement** about the product's data-protection
  capability, repeated on two public pages. Every data-subject request PropDesk receives today is a
  request it has advertised it can satisfy and cannot. Under Kenya's Data Protection Act 2019 a data
  controller must honour a data-subject's right to erasure; under the DPA the processor must *assist* the
  customer within statutory timeframes, and the deletion claim is what the customer relies on. It is also
  the one claim a regulator or an aggrieved former landlord can verify in five minutes.
* **Fix:** Implement `DELETE /api/account` (see `audit/design/encryption-design.md` §9): wipe every
  `user_id`-scoped table, delete the user's Storage objects, delete the Supabase Auth user, write a
  non-identifying tombstone, and make the settings UI reflect the 30-day promise. Until that ships, change
  the two pages to describe export/correction only.

### CRYPTO-013 — Tenant offboarding leaves the tenant's PII behind in tables with no cascade
* **Severity:** MEDIUM · **Category:** `retention-gap`
* **Location:** `app/api/tenants/[id]/route.ts:80-90` · `db/migrations/001-core.sql:193` ·
  `supabase-setup/10-holy-grail.sql:90-116`
* **Evidence:** `DELETE /api/tenants/[id]` deletes the `tenants` row and nothing else. `documents.tenant_id`
  is `on delete set null` (`db/migrations/001-core.sql:193`), so the document row and its `file_url` survive.
  `c2b_transactions` has no FK to `tenants` at all and keeps `msisdn`, `first_name`, `last_name` and the
  full `raw` payload. `rent_payments.tenant_id` does cascade (`db/migrations/001-core.sql:101`), but
  `reconciliation_audit.matched_tenant_id` is `on delete set null`
  (`supabase-setup/10-holy-grail.sql:395`) and its `notes` column carries the match commentary.
* **Impact:** The action a landlord takes to "remove a former tenant" — deleting the tenant record — does
  not remove the tenant's identity document, their phone number, their payer's name and MSISDN, or their
  payment history from the database. Because `c2b_transactions` is not FK-bound, those rows are invisible
  to any per-tenant cleanup query. The result is unbounded retention of a natural person's data with no
  legitimate basis, which is exactly the failure mode Kenya's DPA 2019 and GDPR Art. 5(1)(e) target.
* **Fix:** On tenant delete, run a redaction sweep over `documents` (row + Storage object),
  `c2b_transactions` (MSISDN, names, `raw`), `mpesa_transactions`, `notifications` and
  `reconciliation_audit` for that tenant. Encrypted columns make this feasible: redact by decrypting and
  replacing with a fixed tombstone value, or by dropping the column for that row.

### CRYPTO-014 — The backup subsystem is a permanent plaintext replica of every PII field
* **Severity:** HIGH · **Category:** `retention-gap`
* **Location:** `lib/backup.ts:181-203` · `lib/backup.ts:286-300` · `lib/storage.ts:26-57` ·
  `app/api/backup/auto/route.ts:95-110` · `app/api/export/route.ts:20-29` · `lib/system.ts:22-42`,
  `:132-152`
* **Evidence:** `exportBackup` runs `select *` over 19 tables — including `tenants`, `contacts`,
  `c2b_transactions`, `documents`, `reconciliation_audit` — and returns the rows verbatim. The result is
  stored as plaintext JSON in `backups.payload` (jsonb) or uploaded verbatim to the `backups` Storage bucket
  (`lib/storage.ts:34-40`). `sanitiseRow` (`lib/system.ts:145-152`) strips only 11 credential-shaped column
  names (`password`, `token`, `secret`, `api_key`, …) — `national_id`, `phone`, `email`, `msisdn` and `raw`
  are **not** on that list, so every one of them is copied into the backup. `prune_old_backups`
  (`supabase-setup/12-auto-backup.sql:11-30`) keeps the **50 most recent** snapshots per user, so plaintext
  PII accumulates indefinitely.
* **Impact:** The backup table and the `backups` bucket are, functionally, a **second plaintext database**
  containing national ID numbers — and they are the *least* protected part of the system: the `backups`
  bucket has **no storage policy at all** (only `documents` gets one, `supabase-setup/01-create-tables.sql:331-351`),
  the payload is served back to the browser at `app/api/backup/[id]/route.ts:21`, and it is the input format
  for restore (`app/api/backup/import/route.ts:53` → `lib/backup.ts:209-260`), which writes rows straight
  back with `insert … on conflict do update` — i.e. **a restore after encryption would write plaintext PII
  back into the encrypted columns.** Any deletion flow that only touches the source tables leaves the
  backup copy intact, which is why CRYPTO-012's "delete my data" promise is currently impossible to keep.
* **Fix:** (a) Encrypt the backup payload with a dedicated backup key before persisting or uploading, and
  decrypt on download; (b) add `national_id`, `id_number`, `phone`, `msisdn`, `email` to a PII-aware
  redaction list for the CSV/JSON export path, or encrypt per-field before packaging; (c) make restore
  decrypt-aware; (d) define explicit policies for the `backups` bucket.

### CRYPTO-015 — There is no record of who read or changed sensitive data
* **Severity:** HIGH · **Category:** `missing-audit-log`
* **Location:** `db/migrations/002-support.sql` (no audit table) ·
  `supabase-setup/10-holy-grail.sql:389-408` (the only audit-shaped table)
* **Evidence:** The only audit table is `reconciliation_audit`, which records **payment matching decisions**
  only. There is no table, no middleware hook and no wrapper that records "user X read tenant Y's national
  ID", "user X exported the tenants table" or "user X downloaded an identity document". `lib/api/index.ts`
  (`withAuth`) and `lib/api/with-db-auth.ts` log request failures to stdout
  (`lib/api/index.ts:55`, `lib/api/with-db-auth.ts:106`) and nothing else.
* **Impact:** A landlord who suspects a former employee or a compromised session exported their tenants'
  national IDs has **no way to detect it, prove it, or bound it** — there is no access log, no download log
  and no export log. PropDesk cannot answer a data-subject access request ("who saw my ID number?"), cannot
  perform forensic investigation after a breach, and cannot meet the DPA's own promise of "audit logging"
  as a technical measure (`app/(marketing)/legal/dpa/page.tsx:82-88`). Detecting a bulk export today would
  require database-side query logging, which is not enabled on Neon here.
* **Fix:** Add the `data_access_audit` table and write path specified in
  `audit/design/encryption-design.md` §10: actor id, action, resource type, resource id, outcome, request
  id, hashed IP, timestamp — and **never the PII value itself**.

### CRYPTO-016 — The privacy policy claims row-level security that the primary database does not have
* **Severity:** CRITICAL · **Category:** `legal-claim-gap`
* **Location:** `app/(marketing)/legal/privacy/page.tsx:49-55` · `db/migrations/001-core.sql:9-13` ·
  `lib/api/with-db-auth.ts:14-15`
* **Evidence:** The privacy policy says: *"We use Supabase's row-level security to ensure that one landlord
  can never see another landlord's data."* The primary database is **Neon**, and the migration header is
  explicit: *"No `auth.users` foreign keys — `user_id` is a plain uuid. Application code is responsible for
  scoping every query by the authenticated user's id"*. `lib/api/with-db-auth.ts:14-15` repeats it:
  *"The handler must explicitly scope every query by `userId` — there's no RLS on Neon, so the application
  code carries that responsibility."* The RLS policies in `supabase-setup/*.sql` apply only to the legacy
  Supabase fallback path.
* **Impact:** The published isolation guarantee does not describe the production architecture. Tenant
  isolation on Neon rests entirely on every single query remembering `.eq("user_id", userId)` — one
  forgotten predicate is a cross-tenant breach, and there is no database-level backstop (see
  `app/api/mpesa/c2b/validation/route.ts:75-80` for a live example of an unscoped query). The statement is
  the kind of sentence that is quoted verbatim in a breach notification, an enterprise security
  questionnaire, or a regulator's finding.
* **Fix:** Two options, both acceptable: **(a) immediate** — correct the policy text to describe the actual
  architecture (application-layer scoping on Neon, RLS on the Supabase fallback); **(b) hardening** — put
  RLS on Neon using `request.jwt.claim.sub` and a `set local` role per transaction. Recommend (a) now
  (it is a one-paragraph edit and removes a false statement) and (b) in the hardening cycle.

### CRYPTO-017 — The published sub-processor list names the wrong primary database
* **Severity:** MEDIUM · **Category:** `legal-claim-gap`
* **Location:** `app/(marketing)/legal/privacy/page.tsx:51` · `app/(marketing)/legal/dpa/page.tsx:73-79` ·
  `lib/db/neon.ts:19`
* **Evidence:** Privacy: *"Your data is stored in our Supabase (PostgreSQL) project, hosted on AWS."* DPA
  sub-processors: *"Supabase (PostgreSQL hosting) — primary database"* and *"Amazon Web Services — backup
  storage (encrypted)"*. The actual primary database is **Neon** (`@neondatabase/serverless`,
  `lib/db/neon.ts:19`), and backups go to **Supabase Storage** (`lib/storage.ts:14`), not to AWS.
* **Impact:** Neon is a sub-processor that is not disclosed on the page customers sign, and its region is
  not disclosed either. Under Kenya's Data Protection Act 2019 a processor must disclose its
  sub-processors; under GDPR Art. 28 the same. A customer performing a transfer-impact assessment from this
  list is working from incorrect facts — and the "AWS" entry conceals that the primary datastore is a
  different vendor with a different region and a different breach history.
* **Fix:** Add Neon (and its region) to the sub-processor list on the privacy page, the DPA page and
  `app/(marketing)/sub-processors`, and correct the backup-storage vendor. Cross-check
  `app/(marketing)/help/page.tsx:68` which repeats the same claim.

### CRYPTO-018 — "Backups are encrypted at rest" is not true of the application's own backup artefacts
* **Severity:** MEDIUM · **Category:** `legal-claim-gap`
* **Location:** `app/(marketing)/legal/privacy/page.tsx:52` ·
  `app/(marketing)/security/page.tsx:31` · `lib/storage.ts:34-40` · `lib/backup.ts:297`
* **Evidence:** The privacy policy states *"Backups are encrypted at rest and in transit"*; the security
  page states *"Daily encrypted backups, multi-region failover on the Agency tier."* The artefacts are
  plaintext JSON: uploaded with `contentType: "application/json"` and no encryption
  (`lib/storage.ts:36-40`), and persisted inline as `payload: record.payload` in a jsonb column
  (`lib/backup.ts:297`). The `backups` bucket has no storage policy defined anywhere.
* **Impact:** "Encrypted at rest" is only true of the *hosting provider's disk*. The artefact itself is
  readable by anyone holding the service-role key, is downloadable by the account owner at any time, and is
  re-uploaded on every scheduled run. The claim materially overstates the control, and the `backups` bucket
  has an undefined privacy posture (public? private? policies?).
* **Fix:** Encrypt the backup payload with a dedicated key before persisting/uploading (design §9), define
  explicit policies for the `backups` bucket, then the claim is accurate. Otherwise reword the two pages
  to say "infrastructure-level disk encryption at rest; application-level encryption of the tenant's
  personal data" — which is what §5 of the design will make true.

### CRYPTO-019 — The security page advertises "AES-256 at rest" and per-tenant keys that do not exist
* **Severity:** MEDIUM · **Category:** `legal-claim-gap`
* **Location:** `app/(marketing)/security/page.tsx:16` (and `:31`, `:49`)
* **Evidence:** *"TLS 1.3 in transit. AES-256 at rest. Per-tenant encryption keys in our roadmap."* There is
  no application-layer encryption in the repository (CRYPTO-007) and no per-tenant key mechanism. The same
  page is the canonical description of the processor's technical and organisational measures, linked from
  the DPA (`app/(marketing)/legal/dpa/page.tsx:82-88`).
* **Impact:** A security representation the code does not support, published to enterprise prospects and
  cited in a contractual document. If the design in this track is implemented, the claim becomes true for
  the tenant PII columns — but only for the columns in the plan, and the page still needs to distinguish
  infrastructure disk encryption from application field encryption.
* **Fix:** Implement the design, then re-word precisely: which fields are field-encrypted, which are
  covered only by infrastructure encryption, and what the per-tenant key roadmap actually delivers.

### CRYPTO-020 — The DPA promises EU/Kepler residency and 90-day post-termination deletion; neither exists
* **Severity:** MEDIUM · **Category:** `legal-claim-gap`
* **Location:** `app/(marketing)/legal/dpa/page.tsx:99-105` · `app/(marketing)/legal/dpa/page.tsx:114-120` ·
  `app/(marketing)/help/page.tsx:68`
* **Evidence:** *"Personal data is primarily stored in the EU (Frankfurt) and Kenya (Nairobi) regions. …
  Customers may request region locking on Agency and Enterprise plans."* and *"Within 90 days of
  subscription termination, PropDesk Africa will delete all personal data associated with the customer
  account, except where retention is mandated by law (e.g. financial records for 7 years)."* There is no
  region-selection code anywhere, and no subscription-termination or cancellation handler that deletes
  data — `app/api/subscription/**` and `app/api/stripe/webhook/route.ts:26-45` only flip subscription status.
* **Impact:** A contractual deletion SLA with nothing behind it, and a residency commitment that cannot be
  honoured. The gap compounds CRYPTO-012: even if a customer cancels and asks for deletion, there is no code
  path that would comply, so national IDs and M-Pesa records remain in Neon and — worse — in the 50 retained
  plaintext backups per user (CRYPTO-014).
* **Fix:** Implement the termination purge by reusing the account-deletion routine from CRYPTO-012, and
  either implement region selection or reword the residency clause to describe the actual Neon region.

### CRYPTO-021 — PII is duplicated into columns and free-text fields outside any encryption plan
* **Severity:** MEDIUM · **Category:** `plaintext-pii`
* **Location:** `supabase-setup/10-holy-grail.sql:327-341` (`contacts`) ·
  `supabase-setup/10-holy-grail.sql:180-181` (`managed_landlords.contact_email/contact_phone`) ·
  `db/migrations/001-core.sql:38-39` (`user_profiles.phone/address`) ·
  `db/migrations/002-support.sql:12-13` (`notifications.title/message`) ·
  `db/migrations/001-core.sql:91`, `:111`, `:134`, `:161`, `:197` (free-text `notes`)
* **Evidence:** `contacts` has `email` and `phone` columns and is a first-class table in
  `BACKUP_TABLES` (`lib/system.ts:37`); `managed_landlords` holds a landlord's `contact_email` and
  `contact_phone`; `user_profiles` holds the landlord's own `phone` and `address`; the lease-expiry scan
  interpolates the tenant's full name into `notifications.title` and `notifications.message`
  (`db/migrations/002-support.sql:35-46`); and every entity has an unconstrained `notes` text column that
  landlords routinely use to paste national ID numbers ("ID 23456789, receipt M-Pesa QJG…").
* **Impact:** An encryption plan that stops at `tenants.national_id` and `tenants.phone` leaves exactly the
  same data classes in clear text one table over — in `contacts`, in the notification feed, in the
  landlord's own profile, and in free text. The free-text `notes` columns are the hard case: they cannot be
  encrypted column-wise without destroying search and the UI, and they are the most likely place for a
  landlord to have pasted an ID number.
* **Fix:** Extend the column plan to `contacts.email`, `contacts.phone`,
  `managed_landlords.contact_email/contact_phone` and `user_profiles.phone`. For free text, use
  data minimisation plus a DLP scrubber on write (detect and redact Kenyan ID / M-Pesa receipt patterns
  and route them into an encrypted side column) rather than blanket encryption — see the design §7.

### CRYPTO-022 — Emergency-contact columns are written by the API but do not exist in the Neon schema
* **Severity:** LOW · **Category:** `plaintext-pii`
* **Location:** `app/api/tenants/route.ts:13-14`, `:67-68` · `app/api/tenants/[id]/route.ts:59-60` ·
  `db/migrations/001-core.sql:76-94` (column absent) ·
  `supabase-setup/01-create-tables.sql:64-65` (column present)
* **Evidence:** The API whitelist accepts `emergency_contact_name` / `emergency_contact_phone` and inserts
  them, but the Neon `tenants` table has neither column — only the Supabase-path table does.
* **Impact:** Two issues. Data-protection-wise: a **third party's** phone number (the emergency contact,
  who is not the landlord and not the tenant) is collected and stored with no classification, no retention
  rule and no mention in the privacy policy's "what we collect" list
  (`app/(marketing)/legal/privacy/page.tsx:31-38` says only "Account data" and "Property data").
  Operationally: on the Neon path these inserts fail (unknown column), so the API errors out — the two
  database paths have diverged, and any inventory that reads only `db/migrations/*.sql` will miss real
  columns.
* **Fix:** Add the two columns to `db/migrations/003-*.sql` with a data class of *PII (third party)*, give
  them the same encryption treatment as `contacts.phone`, and add them to the privacy page's collection
  list. The design's inventory must cover **both** schema sources.

### CRYPTO-023 — The C2B validation endpoint reads across every landlord's tenant rows
* **Severity:** MEDIUM · **Category:** `missing-storage-policy`
* **Location:** `app/api/mpesa/c2b/validation/route.ts:59-93`
* **Evidence:** `isReasonableTransaction` runs `select id from public.tenants where phone = … or phone like …`
  with **no `user_id` filter** on a public, unauthenticated endpoint. The owner of the paybill is known
  (`resolveOwnerByShortCode`, `app/api/mpesa/c2b/confirmation/route.ts:98-117`) but is not applied here. The
  function then falls through to `return true` (`:95-97`) — "accept by default" — so the query is not even
  load-bearing for the accept/reject decision.
* **Impact:** The endpoint reads the identity column of every tenant on the platform on every C2B payment
  attempt, with no tenant scoping, and leaks the answer through response timing. It is the concrete proof
  that "there is no RLS on Neon, so the application code carries that responsibility"
  (`lib/api/with-db-auth.ts:14-15`) is a live risk rather than a theoretical one — and it is the strongest
  single argument for CRYPTO-016's option (b), putting RLS on Neon.
* **Fix:** Scope the query to the paybill owner (`and t.user_id = ${ownerUserId}`), and once `phone` is
  encrypted, look it up through the blind index (CRYPTO-002). If the fallback "accept by default" is kept,
  the query can simply be deleted.

### CRYPTO-024 — The service-role key is used in user-facing write paths, disabling the storage policies
* **Severity:** MEDIUM · **Category:** `key-management`
* **Location:** `app/api/properties/[id]/photos/route.ts:59-63` ·
  `app/api/mpesa/callback/route.ts:62-67` · `app/api/stripe/webhook/route.ts:18-21` ·
  `lib/supabase/service.ts:15-25`
* **Evidence:** The photo upload route creates a service-role client and uses it for the upload; the M-Pesa
  callback and the Stripe webhook do the same for their writes. The service-role key **bypasses every RLS
  and storage policy** — that is its purpose.
* **Impact:** The service-role key is the platform's real master credential: it can read and write every
  table and every bucket for every landlord, including the `documents` bucket that the storage policies
  were supposed to guard. The policies in `supabase-setup/01-create-tables.sql:336-351` therefore protect
  only the paths that deliberately avoid the service role. Any code path that "helpfully" upgrades to the
  service key silently voids the isolation model — which is exactly what happened to property photos
  (CRYPTO-006).
* **Fix:** Restrict service-role usage to the three genuinely public callbacks (M-Pesa C2B
  validation/confirmation, Stripe webhook, backup cron) and to the storage signed-URL helper; use the
  user-scoped client everywhere else, including uploads. Record the key in the key-management runbook with
  its rotation procedure, and never expose it in a `NEXT_PUBLIC_*` variable.

### CRYPTO-025 — The dashboard reads sensitive columns directly from the browser, bypassing the server
* **Severity:** HIGH · **Category:** `plaintext-pii`
* **Location:** `app/dashboard/tenants/[id]/page.tsx:27-36` · `app/dashboard/tenants/page.tsx:37-47` ·
  `app/dashboard/properties/[id]/page.tsx:27-31` · `app/dashboard/contacts/page.tsx:20-24` ·
  `app/dashboard/documents/page.tsx:23` · `app/dashboard/paybill/page.tsx:22-23`
* **Evidence:** These are `"use client"` components that build the **browser** Supabase client
  (`lib/supabase/client.ts:11-20`) and read the tables directly from PostgREST:
  ```ts
  const supabase = createClient()
  const { data, error } = await supabase
    .from("tenants")
    .select(`*, properties (id, name, address, rent_amount, monthly_rent)`)   // app/dashboard/tenants/[id]/page.tsx:29-34
  ```
  `select("*")` returns `national_id` and `phone` in clear text to the browser. Every *write* goes
  through the server (`components/tenant-form.tsx:85` → `apiFetch("/api/tenants")`), so the asymmetry is
  read-side only.
* **Impact:** Two consequences. (1) **Security:** the entire sensitive-column read surface is reachable
  from the browser with the anon key that ships in the client bundle, with no server mediation, no audit
  trail and no rate limit — the RLS policies on the Supabase path are the only thing standing in the way,
  and the Neon path has no RLS at all (CRYPTO-016). (2) **It is a hard blocker for application-layer
  encryption.** The browser cannot decrypt an `v1:…` envelope — the key must never be sent to the client —
  so until these reads are proxied through the server, encrypting `tenants.national_id` makes the tenant
  detail page render `v1:IvTagCt…` instead of the ID number. Any implementation of the encryption design
  must start by moving these reads server-side.
* **Fix:** Add server routes (or convert the pages to server components) that read the sensitive tables and
  decrypt server-side, and change the client components to call them. The files to convert are
  `app/dashboard/tenants/**`, `app/dashboard/properties/[id]/**`, `app/dashboard/contacts/**`,
  `app/dashboard/documents/**`, `app/dashboard/paybill/**` and `app/dashboard/reconciliation/**`. This is
  **Phase 0** of `audit/design/encryption-design.md` §11.

---

## 3. Confirmed correct (checked, no finding raised)

* **Passwords are handled entirely by Supabase Auth.** The application never hashes, stores or compares a
  password. Sign-in is `supabase.auth.signInWithPassword` (`lib/actions.ts:26-29`), sign-up is
  `supabase.auth.signUp` (`lib/actions.ts:70-76`), and password change is `supabase.auth.updateUser`
  (`app/(marketing)/auth/reset-password/form.tsx:57`, `lib/actions/settings.ts:130`). Password hashing
  (bcrypt, in GoTrue) is Supabase's responsibility and is correct there. **Do not introduce an
  application-side password scheme.**
* **No OTP or verification code is stored by the app.** There is no code column, no code table and no code
  comparison anywhere in `app/**` or `lib/**`; email verification and password reset are delegated to
  Supabase Auth (`lib/actions.ts:70-76`, `app/(marketing)/auth/forgot-password/action.ts:12-14`).
  `components/ui/input-otp.tsx` is a shadcn input component with no backend counterpart.
* **The Stripe webhook signature is verified correctly.** `getStripe().webhooks.constructEvent(payload,
  signature, secret)` (`app/api/stripe/webhook/route.ts:13`) performs the SDK's constant-time HMAC-SHA256
  verification and throws on mismatch; the route returns 400 (`:15`). The webhook secret is compared
  inside the SDK, not with `===`. Idempotency is handled by the unique `billing_webhook_events.event_id`
  (`:22-23`).
* **The M-Pesa callback secret comparison already has a correct equal-length guard** before
  `timingSafeEqual` (`app/api/mpesa/callback/route.ts:34`) — it is the pattern CRYPTO-008/009/010 should
  adopt. It is only the length *oracle* and the code-unit/byte mismatch that need the digest-based fix in
  CRYPTO-011.
* **`withAuth` / `withDbAuth` enforce a same-origin check on every mutating request**
  (`lib/api/index.ts:34-40`, `lib/api/with-db-auth.ts:76-80`), and `withAuth` uses the server-validated
  `supabase.auth.getUser()` rather than the client-decodable `getSession()`
  (`lib/api/index.ts:42-50`, `lib/supabase/server.ts:15-19`).
* **Every route in the inventory scopes its reads by `user_id`** — with the two exceptions already raised
  (CRYPTO-002 / CRYPTO-023) — and the Neon driver is used with parameterised templates
  (`lib/db/neon.ts:36-42`). The unscoped `sql.unsafe()` calls that do exist
  (`app/api/migrations/run/route.ts:117`) are behind `MIGRATION_SECRET`.

---

## 4. Summary

| ID | Severity | Category | Title |
|---|---|---|---|
| CRYPTO-001 | CRITICAL | plaintext-pii | Tenant national ID numbers stored in plaintext |
| CRYPTO-002 | HIGH | plaintext-pii | Tenant phone plaintext + unscoped public lookup |
| CRYPTO-003 | HIGH | plaintext-pii | M-Pesa payer identity (MSISDN, legal name) plaintext, no tenant FK |
| CRYPTO-004 | HIGH | plaintext-pii | Raw Daraja payloads persisted as plaintext jsonb |
| CRYPTO-005 | CRITICAL | missing-storage-policy | `documents` bucket is PUBLIC — RLS inert for reads |
| CRYPTO-006 | HIGH | missing-storage-policy | Property photos bypass the storage path policy |
| CRYPTO-007 | CRITICAL | key-management | No application-layer encryption, no key material, no registry |
| CRYPTO-008 | MEDIUM | weak-compare | `CRON_SECRET` compared with `!==` |
| CRYPTO-009 | MEDIUM | weak-compare | `MIGRATION_SECRET` compared with `===` on three SQL-executing routes |
| CRYPTO-010 | MEDIUM | weak-compare | `BACKUP_CRON_SECRET` compared with `===`; open when unset |
| CRYPTO-011 | LOW | weak-compare | M-Pesa callback secret leaks length; code-unit vs byte length |
| CRYPTO-012 | HIGH | retention-gap | No account-deletion path, but privacy policy + help centre promise one |
| CRYPTO-013 | MEDIUM | retention-gap | Tenant offboarding leaves PII in non-cascading tables |
| CRYPTO-014 | HIGH | retention-gap | Backups are a permanent plaintext PII replica; restore rewrites plaintext |
| CRYPTO-015 | HIGH | missing-audit-log | No record of who read or changed sensitive data |
| CRYPTO-016 | CRITICAL | legal-claim-gap | Privacy policy claims RLS that Neon does not have |
| CRYPTO-017 | MEDIUM | legal-claim-gap | Sub-processor list names the wrong primary database |
| CRYPTO-018 | MEDIUM | legal-claim-gap | "Backups are encrypted at rest" is not true of the artefacts |
| CRYPTO-019 | MEDIUM | legal-claim-gap | Security page advertises AES-256-at-rest and per-tenant keys that don't exist |
| CRYPTO-020 | MEDIUM | legal-claim-gap | DPA promises EU/Nairobi residency and 90-day termination deletion; neither exists |
| CRYPTO-021 | MEDIUM | plaintext-pii | PII duplicated into `contacts`, `managed_landlords`, notifications and free text |
| CRYPTO-022 | LOW | plaintext-pii | Emergency-contact (third-party) PII written by the API, absent from the Neon schema |
| CRYPTO-023 | MEDIUM | missing-storage-policy | C2B validation endpoint reads across every landlord's tenants |
| CRYPTO-024 | MEDIUM | key-management | Service-role key used in user-facing write paths, disabling storage policies |
| CRYPTO-025 | HIGH | plaintext-pii | Dashboard reads sensitive columns directly from the browser, bypassing the server |

**25 findings — Critical: 4 · High: 8 · Medium: 11 · Low: 2**

**Design that implements the fixes:** `audit/design/encryption-design.md`.

---

## Remediation status (owner-side pass, after this track reported)

This file is the original finding write-up. The **current status of every
finding in this track** lives in `audit/findings/crypto.json` — each entry carries a `status`
(`FIXED` / `PARTIAL` / `OPEN` / `DONE`) and a `fix_notes` field describing
what was actually changed.

Track summary as of the end of the hardening pass:

| Severity | Total | FIXED | PARTIAL | OPEN | DONE |
|---|---:|---:|---:|---:|---:|
| CRITICAL | HIGH | LOW | MEDIUM | 25 | 6 | 4 | 15 | 0 |


The headline for this track: the encryption core is built and independently verified, but **no row is encrypted yet** — the read/write paths still have to be converted and the backfill has to run. The public legal copy also makes claims about row-level security and data residency that the platform does not honour.

See `AUDIT_REPORT.md` for the consolidated verdict and `HARDENING_RUNBOOK.md`
for the go-live sequence.
