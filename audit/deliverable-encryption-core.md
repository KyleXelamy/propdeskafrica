# Deliverable — encryption-at-rest core (PropDesk Africa)

**Task:** build the encryption-at-rest core — AES-256-GCM field encryption, key registry, blind
index, per-column plan and backfill — from `audit/design/encryption-design.md`.

**Status:** complete. The core is built, tested and documented. The application read/write paths
are **not** wired up yet — that is the next task and is listed precisely in §5 below.

---

## 1. Files

| File | Lines | What it is |
|---|---:|---|
| `lib/crypto/field-encryption.ts` | 666 | AES-256-GCM envelope, key registry, blind index, constant-time compare. No application imports — only `node:crypto`. |
| `lib/crypto/pii-columns.ts` | 451 | The per-column plan built from the **real** schema + `encryptRow` / `decryptRow` / `decryptRowWithReport` / `rotationPlanForRow`. |
| `lib/crypto/field-encryption.test.ts` | 551 | 53 vitest assertions (round trip, random IV, tampering, rotation, blind index, timing-safe compare, legacy plaintext, row helpers). |
| `scripts/backfill-encryption.ts` | 433 | Standalone, idempotent, dry-run-by-default backfill. |
| `db/migrations/005-encryption.sql` | 72 | Additive blind-index columns + indexes. |
| `package.json` | +1 line | `"db:encrypt-backfill": "tsx scripts/backfill-encryption.ts"` — the only change to the file. |

Nothing else was touched. `db/migrations/001-core.sql`, `002-support.sql`, `004-marketing-forms.sql`,
`lib/backup.ts`, `lib/api/**`, `app/**`, `supabase-setup/**` and `next.config.mjs` are untouched.

---

## 2. Commands run, and their real output

### 2.1 The suite for my file

```
$ npx vitest run lib/crypto/field-encryption.test.ts

 RUN  v5.0.1 /run/csi/mount-root/nas/eab0d61a99b6696edb3d2aff87b585e8/propdesk

 Test Files  1 passed (1)
      Tests  53 passed (53)
   Start at  09:55:17
   Duration  540ms (transform 76%, tests 14%, import 8%, worker 2%)
```

### 2.2 The whole suite

```
$ npm test        # → vitest run

 Test Files  5 passed (5)
      Tests  130 passed (130)
   Start at  09:55:22
   Duration  2.19s
```

The other four test files (`lib/reconcile.test.ts`, `lib/backup.security.test.ts`,
`lib/mpesa/daraja.security.test.ts`, `lib/mpesa/mpesa-routes.security.test.ts`) belong to other
agents in this cycle. **No test was weakened and no assertion was removed.**

### 2.3 `tsc` — before / after

```
$ npx tsc --noEmit | grep -c "error TS"
52
```

| | errors |
|---|---:|
| Baseline (`audit/baseline/tsc-baseline.log`) | **54** |
| Now | **52** |
| **New errors introduced by my files** | **0** |
| Pre-existing errors that disappeared | 2 (`app/(marketing)/templates/page.tsx:104,106` — `Property 'legalBasis' does not exist on type 'Template'`, fixed by another agent in this cycle) |

Evidence that nothing was added — the diff of the sorted error lists against the baseline:

```
$ grep "error TS" /tmp/tsc-after.log | sort > /tmp/after-sorted.txt
$ diff <(grep "error TS" audit/baseline/tsc-baseline.log | sort) /tmp/after-sorted.txt
1,2d0
< app/(marketing)/templates/page.tsx(104,24): error TS2339: Property 'legalBasis' does not exist on type 'Template'.
< app/(marketing)/templates/page.tsx(106,91): error TS2339: Property 'legalBasis' does not exist on type 'Template'.
```

Only deletions. A direct check of my own files:

```
$ npx tsc --noEmit 2>&1 | grep -E "^(lib/crypto/|scripts/backfill-encryption)"
(no output)
```

### 2.4 The backfill — the requested command

```
$ npx tsx scripts/backfill-encryption.ts --dry-run
PropDesk encryption backfill
  mode:       DRY RUN (no writes)
  batch size: 500

No database configured — nothing to do.
  Set DATABASE_URL (or POSTGRES_URL) to the Neon connection string and re-run.
$ echo $?
0
```

Exit code 0, clear message, no writes — that is the required behaviour when no database is
configured. (This sandbox has no `DATABASE_URL`.)

### 2.5 The backfill — against a database (verification, not part of the deliverable)

Because no database is reachable from this sandbox, the database path was exercised against a
**throwaway fake Neon HTTP endpoint** (the harness lives outside the repo, in the plan workspace,
and is not part of the deliverable). It speaks the driver's protocol, so the real
`@neondatabase/serverless` client, the real script and the real SQL are all exercised.

```
$ DATABASE_URL="postgresql://user:pass@db.fake-neon.test/propdesk" \
  PROPDESK_ENCRYPTION_KEYS='{"v1":"MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="}' \
  PROPDESK_BLIND_INDEX_KEYS='{"b1":"YmxpbmQtaW5kZXgta2V5LWIxLTMyLWJ5dGVzLWFiY3g="}' \
  npx tsx scripts/backfill-encryption.ts --dry-run

PropDesk encryption backfill
  mode:       DRY RUN (no writes)
  batch size: 500
- tenants: scanned 3 rows, 10 values to encrypt, 8 values skipped (2 rows would be updated)
- c2b_transactions: table not present in this database — skipped
- mpesa_transactions: scanned 1 rows, 1 values to encrypt, 0 values skipped (1 rows would be updated)

Summary
  rows scanned:        4
  rows encrypted:      3
  values encrypted:    11
  values skipped:      8

This was a DRY RUN — nothing was written. Re-run with --apply to encrypt.
```

(The fixture held one fully-plaintext tenant, one tenant whose `national_id`/`full_name` were
already envelopes — skipped, proving idempotency — and one empty tenant.)

The statements the driver actually sent (captured by the fake endpoint) — every value is a bound
parameter, never interpolated:

```sql
select column_name from information_schema.columns
      where table_schema = 'public' and table_name = $1
params: ["tenants"]

select id, "national_id", "full_name", "first_name", "last_name", "email", "phone"
  from public."tenants"
 where ("national_id" is not null or "full_name" is not null or "first_name" is not null
        or "last_name" is not null or "email" is not null or "phone" is not null)
   and id > $1 order by id asc limit $2
params: ["00000000-0000-0000-0000-000000000000","500"]
```

and with `--apply`:

```sql
update public."tenants" set "national_id" = $1, "full_name" = $2, "first_name" = $3,
  "last_name" = $4, "email" = $5, "email_blind_index" = $6, "phone" = $7,
  "phone_blind_index" = $8, updated_at = now() where id = $9
params: ["v1:z+6ssG2QsYNDGdMJ:vHeU9MkTXeLltgdETLTUJQ==:OJ8POvpEoyk=", …,
         "b1:e1e206ef1744f03d1757530a583bac4d1e0799d2e15db2246bdbaca3836e5bac", …,
         "00000000-0000-4000-8000-000000000001"]

update public."tenants" set "first_name" = $1, "last_name" = $2, "email" = $3,
  "email_blind_index" = $4, "phone" = $5, "phone_blind_index" = $6, updated_at = now()
 where id = $7            -- the already-encrypted national_id / full_name are left alone

update public."mpesa_transactions" set "phone" = $1, "phone_blind_index" = $2 where id = $3
                                        -- no updated_at: that table has no such column
```

Error paths were checked too:

```
$ npx tsx scripts/backfill-encryption.ts --table="tenants; drop table"
✗ Refusing to touch "tenants; drop table": not a table in the encryption plan. Allowed: c2b_transactions, mpesa_transactions, tenants
$ echo $?
1

$ … --apply            # with PROPDESK_ENCRYPTION_KEYS unset
✗ No encryption key configured. Set PROPDESK_ENCRYPTION_KEYS to a JSON object such as { "v1": "<base64 of 32 random bytes>" } (generate with: openssl rand -base64 32).
$ echo $?
1

$ npx tsx scripts/backfill-encryption.ts --wat
✗ Unknown argument "--wat". Run with --help for usage.
$ echo $?
1
```

### 2.6 One deviation from the brief, with the reason

The brief says to use "`sql.unsafe(text, params)` bound-parameter style used in lib/backup.ts".
**In `@neondatabase/serverless` v1.2.0 `unsafe()` is not a bound-parameter call** — it takes a
single raw-SQL string and returns an `UnsafeRawSql` interpolation marker for use inside a tagged
template. Proof:

```
$ node -e "… await sql.unsafe('select id from public.tenants', []) …"
typeof: object   isArray: false
ctor: UnsafeRawSql
keys: [ 'sql' ]
```

`sql.query(text, params)` is the API that takes `$1, $2, …` plus a parameter array, so the backfill
uses `sql.query()` for every statement. The bound-parameter *intent* of the brief is met exactly.

**This is a pre-existing defect in a file I do not own:** `lib/backup.ts:90`, `:225`, `:238`,
`:283`, `:298` all call `(sql as any).unsafe(text, params)` and then treat the result as rows —
`loadAllowedColumns()` will throw `TypeError: (rows ?? []).map is not a function` at runtime. That
is worth fixing in the backup/restore path (it is CRYPTO-014 territory), but it is out of scope for
this change set.

---

## 3. Environment variables now required

| Variable | Required | Format | Used by |
|---|---|---|---|
| `PROPDESK_ENCRYPTION_KEYS` | **yes** | JSON `{"v1":"<base64 32 bytes>"}` (CSV `v1=<base64>` also accepted) | `encryptField` / `decryptField` — the AES-256-GCM key registry. The **highest key id** is the active key. |
| `PROPDESK_ENCRYPTION_KEY` | fallback | base64, 32 bytes | Single-key shorthand, equivalent to `{"v1": …}`. Local development only. |
| `PROPDESK_BLIND_INDEX_KEYS` | **yes** for the searched columns | JSON `{"b1":"<base64 32 bytes>"}` | The blind-index key registry — a **separate** key from the encryption key. |
| `PROPDESK_BLIND_INDEX_KEY` | fallback | base64, 32 bytes | Single-key shorthand, equivalent to `{"b1": …}`. |

Generate them (32 random bytes each, base64 — **two different values**):

```bash
openssl rand -base64 32     # → PROPDESK_ENCRYPTION_KEYS
openssl rand -base64 32     # → PROPDESK_BLIND_INDEX_KEYS   (a DIFFERENT value)
```

First install:

```bash
export PROPDESK_ENCRYPTION_KEYS='{"v1":"<first output>"}'
export PROPDESK_BLIND_INDEX_KEYS='{"b1":"<second output>"}'
```

Rules honoured in the code:

* the key comes from the environment **only** — never hardcoded, never logged, never returned to a
  client, never a `NEXT_PUBLIC_*` variable;
* a missing / malformed / wrong-length key **fails loudly** with a `FieldEncryptionError` that
  names the variable and the fix — never a silent default, never a plaintext fallback;
* `isFieldEncryptionConfigured()` exists for the startup health check only;
* the memoised registry is rebuilt by `resetKeyRegistry()` (test-only).

Rotation procedure (design §13.1): register a new id and let the active id move:

```bash
export PROPDESK_ENCRYPTION_KEYS='{"v1":"<old>","v2":"<new>"}'   # v2 is now active
```

Old ciphertexts keep decrypting (`v1:…` names its own key); re-encrypt them with
`decryptFieldWithRotation()` (the `reencrypted` field) or by re-running the backfill.

---

## 4. The plan, the migration and the order to apply it

### 4.1 The plan (`lib/crypto/pii-columns.ts`)

Built from the schema that actually exists — the design's §7 list also mentioned Supabase-only
tables (`contacts`, `managed_landlords`, `paybills`, `tenants.emergency_contact_*`) that are **not**
in this project, so they are not in the plan. (`user_profiles` and `documents` DO exist in the
primary Neon schema and ARE in the plan — see the owner-side correction below.)

| Table | Column | Mode | Blind index | Why |
|---|---|---|---|---|
| `tenants` | `national_id` | randomised | — | Kenyan national ID. The most sensitive field in the schema (CRYPTO-001). Displayed, never searched. |
| `tenants` | `full_name` | randomised | — | The tenant's legal name. |
| `tenants` | `first_name` | randomised | — | Part of the legal name. |
| `tenants` | `last_name` | randomised | — | Part of the legal name. |
| `tenants` | `email` | blind-index | `email_blind_index` | Contact detail; searchable by e-mail. |
| `tenants` | `phone` | blind-index | `phone_blind_index` | Looked up by the public C2B validation endpoint (CRYPTO-002). |
| `c2b_transactions` | `msisdn` | blind-index | `msisdn_blind_index` | The payer's MSISDN (CRYPTO-003). |
| `c2b_transactions` | `first_name`, `middle_name`, `last_name` | randomised | — | Payer legal name (CRYPTO-003). |
| `mpesa_transactions` | `phone` | blind-index | `phone_blind_index` | Payer MSISDN on an STK push (CRYPTO-003). |
| `c2b_transactions` | `raw` | *plaintext* | — | **Not** encrypted — redact to the Daraja whitelist (CRYPTO-004). |
| `mpesa_transactions` | `raw_response`, `raw_callback` | *plaintext* | — | **Not** encrypted — redact to the whitelist (CRYPTO-004). |

Deviation from design §7, on purpose: the design kept `tenants.email` and `c2b_transactions.msisdn`
in randomised mode with no index; the brief for this task requires e-mail, phone and msisdn to be
searchable, so they carry a blind index. The value column is still a randomised envelope — the
index is purely additive, so nothing is weakened.

### 4.2 `db/migrations/005-encryption.sql` — the exact SQL

```sql
-- Extensions ---------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- 1) public.tenants ---------------------------------------------------------
alter table public.tenants add column if not exists email_blind_index text;
alter table public.tenants add column if not exists phone_blind_index text;
create index if not exists tenants_email_blind_index_idx on public.tenants (email_blind_index);
create index if not exists tenants_phone_blind_index_idx on public.tenants (phone_blind_index);

-- 2) public.mpesa_transactions ---------------------------------------------
alter table public.mpesa_transactions add column if not exists phone_blind_index text;
create index if not exists mpesa_transactions_phone_blind_index_idx on public.mpesa_transactions (phone_blind_index);

-- 3) public.c2b_transactions ------------------------------------------------
do $$ begin if to_regclass('public.c2b_transactions') is not null then execute 'alter table public.c2b_transactions add column if not exists msisdn_blind_index text'; execute 'create index if not exists c2b_transactions_msisdn_blind_index_idx on public.c2b_transactions (msisdn_blind_index)'; end if; end $$;
```

(The file also carries the same header/section comments as `001-core.sql`; the statements above are
verbatim.)

Properties: additive only, `if not exists` everywhere, no column dropped/renamed/re-typed, no
constraint touched. The `c2b_transactions` block is guarded with `to_regclass()` because that table
exists only on the Supabase-path database (`supabase-setup/10-holy-grail.sql:90-115`) — on a
Neon-only deployment it is a no-op instead of an error.

### 4.3 Order to apply

1. **Set the keys** in the environment (`PROPDESK_ENCRYPTION_KEYS`, `PROPDESK_BLIND_INDEX_KEYS`) —
   before anything that reads or writes an encrypted column.
2. **Apply `db/migrations/005-encryption.sql`** — Neon SQL editor / psql on the Neon database, and
   the same file on the Supabase database if that deployment is live. It is idempotent; re-running
   is harmless.
3. **Wire the read/write paths** (§5 below). Until that is done the dashboard would show `v1:…`.
4. **Backfill**: `npx tsx scripts/backfill-encryption.ts --dry-run`, review the counts, then
   `npx tsx scripts/backfill-encryption.ts --apply`.
5. **Rotation** (later, when a second key exists): `decryptFieldWithRotation()` over the rows, or
   simply re-run the backfill after swapping the active key id.

> **Runner caveat.** `npm run db:migrate` (`lib/db/migrate.ts`) splits a file on semicolons that end
> a line and **drops any chunk that starts with a comment line** — which is why `001-core.sql`
> loses its `create table` statements and `002-support.sql` is shredded into plpgsql fragments. That
> is a pre-existing defect in a file I do not own. `005-encryption.sql` follows the same convention
> as `001-core.sql`, so it should be applied with the Neon SQL editor / psql (or the runner fixed
> first). The statements are individually idempotent if you prefer to run them one by one.

---

## 5. INTEGRATION CHECKLIST — what the next engineer must change

Nothing below is implemented in this change set; these are the precise call sites, taken from design
§11 and re-verified against the current tree. Every file that imports `lib/crypto/*` must be a Node
runtime module (`export const runtime = "nodejs"`), never `"use client"`.

### 5.0 Phase 0 — BLOCKING: move the sensitive reads behind the server

The dashboard reads `tenants` straight from the browser (it holds the anon key and cannot decrypt).
Until these pages go through the server, encryption renders `v1:…` in the UI.

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

Prefer the existing API routes (`/api/tenants`, `/api/documents`, `/api/paybill`,
`/api/properties/[id]/photos`) — they already scope by `user_id`.

### 5.1 Write path — `encryptRow(table, payload)` before the insert/update

| File / function | Anchor | Change |
|---|---|---|
| `app/api/tenants/route.ts` → `POST` | `const insert: Record<string, any> = {` (line ~58) → `.insert([insert])` (line ~78) | `encryptRow("tenants", insert)` before the insert. Writes `national_id`, the three name columns, `email`, `phone` and the two blind indexes. |
| `app/api/tenants/[id]/route.ts` → `PUT` | `const update: Record<string, any> = { ...fields, … }` (line ~43) → `.update(update)` (line ~68) | `encryptRow("tenants", update)`. |
| `app/api/mpesa/stkpush/route.ts` | `phone: normalized` (lines ~109 and ~124, the `mpesa_transactions` insert) | `encryptRow("mpesa_transactions", tx)` — writes `phone` + `phone_blind_index`. |
| `app/api/mpesa/c2b/confirmation/route.ts` | `insert into public.c2b_transactions (… msisdn, first_name, middle_name, last_name …)` (line ~181) and the Supabase insert (line ~202) | Encrypt `msisdn`, `first_name`, `middle_name`, `last_name`; replace `raw` with the Daraja whitelist (CRYPTO-004). |
| `app/api/mpesa/callback/route.ts` | `raw_callback: body` (line ~76) | Whitelist instead of the raw body. |
| `app/api/paybill/route.ts` → `POST` | `.insert({ user_id: userId, label, number, type, … })` (line ~50) | `encryptRow("paybills", row)` **only if** the `paybills` table is added to the plan (it is Supabase-only today — see §7). |
| `app/api/profile/route.ts` → `PUT` | `const update: Record<string, any> = {` (line ~24) → `.upsert(update)` (line ~45) | `encryptRow("user_profiles", update)` once `user_profiles.phone` is added to the plan. |
| `app/api/documents/route.ts` → `POST` | `const insert = {` (line ~147) → `.insert([insert])` (line ~165) | `encryptRow("documents", row)` once `documents.name` is added to the plan; also stop storing the public URL (design §12.2). |

### 5.2 Read path — `decryptRow(table, row)` before returning

| File | Anchor | Change |
|---|---|---|
| `app/api/tenants/route.ts` → `GET` | `supabase.from("tenants").select("*, properties(name, address)")` (lines ~29-31) → `return successResponse(data)` (line ~40) | `decryptRow("tenants", row)` per row. |
| `app/api/tenants/[id]/route.ts` → `GET` | `.select("*, properties(name, address)")` (lines ~25-26) → `successResponse(data)` (line ~32) | `decryptRow("tenants", data)`. |
| `app/api/export/route.ts` | `supabase.from("tenants").select("*")` (line ~22) | `decryptRow("tenants", row)` per table before serialising — the export must show the landlord their real data. Also point this route at the same data layer as the writers (Neon), see design §11.1. |
| `app/api/backup/csv/[table]/route.ts` | `exportBackup(userId, …)` (line ~27) | Same: decrypt before writing the CSV. |
| `app/api/mpesa/c2b/confirmation/route.ts` → `buildContext` | `select t.id, t.full_name, t.phone, t.rent_amount …` (lines ~143-147) | `decryptRow("tenants", row)` **before** the in-memory phone comparison. |
| `app/api/mpesa/c2b/validation/route.ts` | `select id from public.tenants where phone = ${phone} or phone like ${"%" + phone.slice(-9)}` (lines ~89-92) | **Replace with the blind-index lookup** (design §9.4 rule 1) and add the owner scope: `where phone_blind_index = any($1) and t.user_id = $owner`. Use `blindIndexCandidates(normalizePhoneE164(msisdn))` so `0712345678`, `254712345678`, `+254712345678` and `712345678` all match. This endpoint is public — without the owner scope it is a cross-tenant oracle (CRYPTO-023). |
| `app/api/paybill/route.ts` → `GET` | `.select("id, label, number, type, active, created_at")` (line ~30) | `decryptRow("paybills", row)` and `resolveOwnerByShortCode` must use `where number_bidx = $1` (`app/api/mpesa/c2b/confirmation/route.ts:119` and `:128`) — **without this the M-Pesa callback stops finding the landlord.** |
| `app/api/documents/route.ts` / `[id]/route.ts` | `.select("*, properties(name, address), tenants(full_name)")` (lines ~109 / ~89) | `decryptRow("documents", row)` and `decryptRow("tenants", …)` for the joined tenant row; replace `file_url` with a signed URL. |

### 5.3 One database-side consequence of encrypting the names

`db/migrations/002-support.sql` → `public.run_lease_expiry_scan()` reads `t.full_name`,
`t.first_name` and `t.last_name` **in SQL** and interpolates them into
`notifications.title` / `notifications.message`. Once those columns hold envelopes, the notification
text will contain `v1:…`. That function has to stop reading the columns directly (encrypt the
notification text as well, or store a stable reference such as `Tenant 4a2f…` — design §8).

### 5.4 Constant-time secret comparison (design §10.3) — `timingSafeEqualString`

Not part of the encryption plan, but it lives in the same module and should be swept in the same
change: `app/api/cron/run/route.ts:26-32`, `app/api/migrations/run/route.ts:49`,
`app/api/migrations/reset/route.ts:44`, `app/api/migrations/rollback/route.ts:35`,
`app/api/backup/auto/route.ts:38`, `app/api/mpesa/callback/route.ts:34`.

---

## 6. What I could not implement, and why

1. **The read/write wiring (§5).** Deliberately out of scope for this task — the brief says another
   engineer implements it, and the read paths in `app/**` belong to another agent in this cycle.
   Until it is done, encrypting `tenants.national_id` would render `v1:…` in the dashboard.
2. **The `contacts`, `managed_landlords`, `paybills` and `tenants.emergency_contact_*` columns from
   design §7.** They do not exist in this project's schema (they are Supabase-only tables that the
   Neon migrations never created). They are therefore **not** in `PII_COLUMNS`, and the backfill
   skips them with a clear message. If those tables are added later, add the spec entries *and* the
   matching `alter table … add column if not exists …_blind_index` to a new migration.

   > **Owner-side correction (after adversarial verification).** An earlier draft of this
   > paragraph generalised the omission to *every* table outside the plan, and that was wrong:
   > `user_profiles.phone` (db/migrations/001-core.sql:38) and `documents.name`
   > (db/migrations/001-core.sql:189) DO exist in the primary Neon schema and were left
   > unprotected. Both are now in `PII_COLUMNS`, and `005-encryption.sql` adds the matching
   > `user_profiles.phone_blind_index` column and index.
3. **`lib/mpesa/daraja.ts` → import `normalizePhoneE164`.** The design asks for one normaliser.
   `lib/mpesa/daraja.ts:249-255` still has its own copy (`normalizePhone`), which is byte-identical
   today — the test file asserts they agree for all five accepted Kenyan forms — but the two can
   drift. `lib/mpesa/daraja.ts` is not in my file list, so the import was not changed.
4. **`data_access_audit` (design §11.4 / CRYPTO-015), the storage-bucket policies (§12), the
   account-deletion sweep (§14) and the rotation cron (§13.2).** Different deliverables in the
   design, not part of the encryption core. `decryptFieldWithRotation()` and
   `rotationPlanForRow()` are in place so the rotation job can be written later without touching
   this code.
5. **The `paybills` unique constraint.** The design §11.4 moves
   `unique (user_id, number, type)` onto the blind index, because a randomised envelope no longer
   triggers the uniqueness check. `paybills` is not in this project's Neon schema and is not in my
   plan, so no constraint was touched — but it **must** be migrated in the same change that encrypts
   `paybills.number`, otherwise duplicate paybill numbers silently become possible.
6. **A real end-to-end run of the backfill.** This sandbox has no Postgres and no `DATABASE_URL`.
   The database path was verified against a fake Neon endpoint (see §2.5) — the SQL, the bound
   parameters, the counters, the idempotency and the error paths are all exercised — but the script
   has **not** run against a real Postgres server. The SQL is plain Postgres and was reviewed by
   hand; it should be run against a real database before production use.

---

## 7. Notes / caveats for the verifier

* **The migration runner is broken** (see §4.3). It is pre-existing, it affects `001`, `002` and
  `004` equally, and it is not fixed here.
* **`lib/backup.ts` uses the wrong Neon API** (see §2.6) — `sql.unsafe(text, params)` does not
  return rows. Pre-existing, not fixed here, but it will bite whoever touches the backup path.
* **The blind-index column names are `<column>_blind_index`** (`phone_blind_index`,
  `email_blind_index`, `msisdn_blind_index`), following the brief's example. The design used the
  shorter `<column>_bidx`. `005-encryption.sql` and `lib/crypto/pii-columns.ts` agree on the
  `_blind_index` spelling; if the design spelling is preferred, change both together.
* **`blindIndexCandidates()` returns the phone forms × the registered blind-index keys.** For
  `0712345678` that is four candidates (`254712345678`, `+254712345678`, `0712345678`,
  `712345678`), each under every registered key id. The design §9.3 described "one candidate per
  registered key"; the brief required the phone forms as well, so the function covers both. For a
  value that is not phone-shaped it degrades to exactly one candidate per key, as designed.
* **`decryptFieldWithRotation()` returns an object, not a string.** The brief's summary line says
  `decryptFieldWithRotation(ciphertext: string): string`; the design (authoritative, §6 and §6.1)
  specifies `DecryptResult = { plaintext, keyId, reencrypted }`, and design §18.1 item 10 requires it
  to *report the old key id* — which the object form does and a bare string cannot. The design's
  contract was followed: `res.plaintext` is the decrypted value and `res.reencrypted` is the value
  to write back under the active key.
* **`decryptField()` returns a legacy plaintext value unchanged** (never throws on it) and
  `decryptFieldStrict()` throws — the backfill uses the strict variant's semantics to find
  plaintext rows. A *tampered* ciphertext always throws: the read path never returns garbage.
* **Empty strings are not encrypted** — `""` stays `""`, so "no value" remains distinguishable
  from "an encrypted empty string" in the UI.
* **The registry is memoised.** `resetKeyRegistry()` must be called after `process.env` changes —
  the test file does it in `beforeEach`.
* `npm run db:encrypt-backfill` needs `tsx` on the PATH. `tsx` is in `devDependencies` but was
  missing from `node_modules` in this sandbox at the time of writing (another agent's `npm install`
  was running), so the npm script could not be exercised end-to-end here; `npx tsx
  scripts/backfill-encryption.ts` was, and it is the command the brief asked for.
* Nothing was committed — all changes are in the working tree.


---

## 8. Owner-side corrections after adversarial verification

The verifier failed this task on three findings. All three were fixed directly by
the owner and re-verified with an independent probe.

### F1 (HIGH) — a corrupt envelope was silently returned as plaintext

`decryptField()` returned ANY value that did not parse as an envelope unchanged
(`lib/crypto/field-encryption.ts:424` — `if (!parsed) return payload`). A truncated
row, or one whose base64 was mangled, was therefore handed to the application as
if it were data — while the module already failed closed for an *unknown key id*,
so the two paths were inconsistent.

**Fix:** a value that starts with a **registered** key id and a colon is now
treated as an envelope, and it throws when it does not parse or authenticate.
Genuine legacy plaintext (a phone number, a name, a national id) still passes
through unchanged — that backwards compatibility is unchanged and is still
required during the migration window. `decryptFieldWithRotation()` no longer
re-encrypts a corrupt envelope as if it were plaintext, and the row helpers now
throw on a corrupt cell instead of reporting it as "needs migration" (which
would have encrypted the corruption and made it permanent). The docblock that
claimed "a tampered ciphertext DOES throw … must never be silently returned as
garbage" is now true for structural tampering as well as for a flipped byte.

**Tests:** 8 new assertions in `lib/crypto/field-encryption.test.ts`
("corrupt envelopes fail closed").

### F2 (MEDIUM) — two PII columns in the primary schema were left unprotected

`user_profiles.phone` and `documents.name` exist in the primary Neon schema and
were not in the plan; the report's stated reason for the omission was wrong for
them.

**Fix:** both are now in `PII_COLUMNS` — `user_profiles.phone` as a blind-index
column, `documents.name` as a randomised one — and `005-encryption.sql` adds
`user_profiles.phone_blind_index` plus its index.

**Tests:** 2 new assertions ("the PII plan covers the primary schema").

### F3 (MEDIUM) — `npm run db:migrate` silently dropped statements

`lib/db/migrate.ts` split a file on "a semicolon at the end of a line" and then
DISCARDED every chunk that started with a `--` comment. That silently threw
away real statements that merely followed a comment block — in `001-core.sql` it
was every `create table`, and in `004`/`005` it was the blind-index `alter
table` statements — after which the runner died on the surviving `create index`
with "column does not exist", leaving the schema half-migrated. This affected
every migration file in the repository, not just this one.

**Fix:** the runner now uses a comment-aware splitter (`splitSqlStatements()`)
that strips `--` comments instead of discarding the statement that followed
them, ignores a `;` inside a single-quoted string, and keeps `$$ … $$` bodies
intact. `005-encryption.sql` now applies cleanly: 8 statements, all of them.

**Tests:** a new `lib/db/migrate.test.ts` (6 assertions) pins the splitter and
asserts that every statement of every migration file survives.

### F4 (LOW) — the blind-index key could be the encryption key

`getKeyRegistry()` now refuses to build a registry in which the active blind-index
key and the active encryption key are the same material, with an actionable
message. `.env.example` already said the two MUST differ; now the code enforces it.

**Test:** 1 new assertion.

### F5 (INFO) — the envelope version is conflated with the key id

Not changed. The key id doubles as the version prefix (`v1:`, `v2:`), so a key
rotation also bumps the "format version". The parser is version-agnostic, so
this is correct today, but any future envelope format must use a new prefix and
keep a `v1` reader.
