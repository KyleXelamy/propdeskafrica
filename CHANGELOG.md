# Changelog

All notable changes to PropDesk Africa are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] — pre-launch hardening

This release closes the findings from the pre-launch security and feature audit.
Finding IDs (`AUTHZ-*`, `INFRA-*`, `CRYPTO-*`, `LEAK-*`, `IND-*`, `FEAT-*`) refer
to the audit register in `audit/findings/`.

### Security

- **AUTHZ-001 / INFRA-002** — closed a SQL injection in the backup restore path.
  Attacker-controlled column names were interpolated into `INSERT` statements.
  Every row key is now validated against a strict identifier pattern *and*
  against the table's real column list (read from `information_schema`, cached)
  before any SQL is constructed, on all three insert branches (skip / replace /
  merge). An unknown or unsafe column now rejects the **whole** restore during a
  pre-flight pass, before a single row is written. Regression coverage added in
  `lib/backup.security.test.ts`.
- **INFRA-001** — closed a SQL injection in `POST /api/backup`. The
  caller-supplied `tables` array is validated against a table allowlist; an
  unknown table returns 400. `lib/backup.ts` re-validates internally so the
  guarantee does not depend on the route.
- **AUTHZ-002** — `POST /api/tenants/[id]/invite` no longer allows a conflict
  target to be reassigned to a tenant the caller does not own.
- **AUTHZ-003** — `DELETE /api/tenants/[id]/invite` now verifies the tenant
  belongs to the caller before unlinking it.
- **AUTHZ-004** — `GET /api/mpesa/c2b/status/[transId]` no longer falls back to
  an unscoped Daraja lookup, which disclosed the payer's phone number to any
  authenticated user. A transaction that is not the caller's returns 404.
- **AUTHZ-006** — `POST /api/payments` now verifies that the referenced property
  and tenant belong to the caller.
- **INFRA-003** — secret comparisons are now constant-time. Added
  `lib/api/secure-compare.ts` (`timingSafeEqualString`, with a length guard
  because `crypto.timingSafeEqual` throws on a length mismatch) and wired it into
  the migration, cron and auto-backup endpoints. Fail-closed semantics unchanged.
- **LEAK-001** — `public/backup-replication-fixture.json` was scrubbed. It
  shipped a founder's full legal name, street address and contact details as a
  "fixture"; it now contains clearly synthetic demo data.
- **LEAK-010** — 41 endpoints returned the raw database error text to the
  client, which can include the database host, database name, schema and table
  names. Added `dbError()` to `lib/api/index.ts` and rewrote every call site
  across 19 route files: the driver detail goes to the server log, the client
  receives a generic message.
- **LEAK-009 / LEAK-012** — raw database exception text is no longer rendered
  in the dashboard.
- **IND-010 / INFRA-010** — added a Content-Security-Policy and hardened the
  HSTS header (`includeSubDomains; preload`). The CSP ships as
  `Content-Security-Policy-Report-Only` on purpose: an enforcing policy without
  a per-request nonce would break Next's inline bootstrap scripts, and a CSP
  that breaks the site is worse than no CSP. The exact header value and the
  switch-over procedure are in `audit/deliverable-storage-infra.md` §6 and in the
  runbook.
- **INFRA-014 / INFRA-015** — the document and photo upload paths now enforce a
  content-type allowlist, an extension allowlist, a magic-byte sniff, a 10 MB
  limit, filename sanitisation, and an ownership check before the upload. Both
  now write through the **user-scoped** Supabase client instead of the service
  role, so the storage policies are actually enforced.

### Fixed

- **The migration runner was silently skipping statements.** `lib/db/migrate.ts`
  split a file on "a semicolon at the end of a line" and then discarded every
  chunk that started with a `--` comment — so real statements that merely
  followed a comment block were thrown away. In `001-core.sql` that was every
  `create table`; in `004-marketing-forms.sql` and `005-encryption.sql` it was
  the blind-index `alter table` statements, after which the runner died on the
  surviving `create index` with "column does not exist" and left the schema
  half-migrated. The splitter is now comment-aware: it strips `--` comments
  instead of discarding the statement that followed them, ignores a `;` inside
  a single-quoted string, and keeps `$$ … $$` function bodies intact. Covered by
  the new `lib/db/migrate.test.ts`.
- **A corrupt encrypted value could be served as if it were readable data.**
  `decryptField()` returned any value that did not parse as an envelope
  unchanged, so a truncated or mangled row was handed to the application as
  plaintext — while the module already failed closed for an unknown key id. A
  value carrying a **registered** key id is now treated as an envelope and
  throws when it does not parse or authenticate. Genuine legacy plaintext still
  passes through unchanged, so a half-migrated table keeps working. The row
  helpers now throw on a corrupt cell instead of reporting it as "needs
  migration" — which would have encrypted the corruption and made it permanent.
- **The blind-index key could be the encryption key.** The registry now refuses
  to build when the two are the same material, with an actionable message.

- **FEAT-005** — removed a duplicate route. `app/(marketing)/page.tsx` and
  `app/page.tsx` both resolved to `/`; the fuller page was kept.
- **FEAT-006** — the public `/status` page now runs a real health probe instead
  of always reporting every system as operational.
- **FEAT-007** — the `/dashboard/settings/system` screen now shows the real app
  version, schema version, database engine, health state and latency.
- **FEAT-008** — the public `/api/system/ping` endpoint no longer returns the
  raw database error message.
- **FEAT-002** — `/api/damages` returned one hard-coded damage record to every
  landlord. It now reads and writes the caller's own rows.
- **FEAT-003** — `/api/quotations` always returned an empty array and discarded
  every write. It now filters and inserts real rows, scoped to the caller.
- **FEAT-004** — the `/dashboard/quotations` page was a static shell over an
  empty array. It now reads the real rows and derives its stat cards from them.
- **FEAT-001** — nine public write endpoints (newsletter, contact, pricing lead,
  enterprise lead, feedback, support, customer-requests, damages, quotations)
  logged the submission and returned a fabricated `ok: true`. They now persist
  to a real table and return an honest 503 when the write fails.
- Corrected the Kenya statute citations in the marketing content
  (`lib/content/marketing.ts`).
- Added the public press pages (`/press`, `/press/brand-guidelines`,
  `/press/company-fact-sheet`).

### Added

- `lib/api/rate-limit.ts` — in-memory, per-instance rate limiting for the public
  write endpoints, with a configurable salt so a restart does not inherit a
  previous window.
- `lib/api/public-submissions.ts` — the shared writer for the nine public
  endpoints. Unknown columns are rejected, every value is bound as a parameter,
  and PII is never logged.
- `lib/api/secure-compare.ts` — constant-time secret comparison.
- `lib/system-health.ts` — one shared health probe for the status page, the
  dashboard settings screen and the public ping endpoint.
- `lib/crypto/field-encryption.ts` — AES-256-GCM field encryption with a
  versioned envelope (`v1:iv:tag:ciphertext`), a multi-key registry for
  rotation, an HMAC blind index for searchable columns, and a
  plaintext-passthrough read path so legacy rows keep working during the
  migration window. A value that carries a registered key id but does not
  parse is treated as a corrupt row and throws — it is never served as data.
- `lib/db/migrate.test.ts` — regression tests for the migration runner's SQL
  splitter.
- `lib/crypto/pii-columns.ts` — the per-column encryption plan built from the
  real schema, with idempotent encrypt-on-write and decrypt-on-read helpers.
- `scripts/backfill-encryption.ts` — idempotent, dry-run-by-default backfill.
- `db/migrations/004-marketing-forms.sql` — tables for the marketing forms.
- `db/migrations/005-encryption.sql` — blind-index columns and indexes.
- `lib/backup.security.test.ts` — 27 regression tests for the backup SQL
  injection fixes.
- `lib/mpesa/daraja.security.test.ts` and `lib/mpesa/mpesa-routes.security.test.ts`
  — 47 regression tests for the M-Pesa callback authentication, the amount
  check, the sandbox-mock guard and the operator allowlist.
- `lib/crypto/field-encryption.test.ts` — 63 assertions covering the crypto
  core, the key registry, the blind index, the row helpers and the corrupt-row
  behaviour.
- `.env.example` — every environment variable the code reads, with the command
  that generates each secret.

### Changed

- `next` was upgraded to 16.4.3. The previous 16.3.8 fell inside the affected
  range of two critical RCE advisories (unauthenticated RCE via the Image
  Optimization API with SVG, and unauthenticated RCE in `use cache` functions)
  plus a Server Actions denial-of-service advisory. `npm audit` no longer
  reports any critical advisory.
- The M-Pesa C2B validation and confirmation paths were unreachable: the
  middleware allowlist did not include them, so Safaricom's callbacks were 401'd
  before they reached the route. They are now allowed through — safely, because
  the routes now fail closed on both the IP allowlist and the shared secret.
- The subscription entitlement is no longer granted from a status query that
  returned a simulated Daraja response, and a production runtime refuses any
  result that did not come from the production gateway.
- The `documents` Storage bucket is now **private**, and documents and property
  photos are served through 5-minute, owner-bound signed URLs. `file_url` now
  stores the Storage object path rather than a public URL; legacy rows holding
  a public URL are still served (URL → path → signed URL), and the migration is
  in the runbook.
- The bucket also carries a `file_size_limit` and an `allowed_mime_types` list.
- `SECURITY DEFINER` functions in the patch SQL no longer grant `EXECUTE` to
  `PUBLIC`, `anon` or `authenticated`; the grant is restricted to `service_role`,
  and both functions now pin `SET search_path = public, pg_temp`.
- Added `vite` as a dev dependency. The test suite could not run from a clean
  install without it, because vitest 5 requires it as a peer dependency.
- Added `vite.config.mts` so the `@/` path alias resolves inside vitest.
- `next.config.mjs` still sets `typescript.ignoreBuildErrors: true`. It was
  hiding 54 type errors from the build, and the count is now known and
  documented (`audit/baseline/tsc-baseline.log`). Turning the flag off requires
  clearing the remaining errors first — see the residual risk list below. The
  CI pipeline checks the type count separately, so a new error still fails the
  build even while the flag is on.

### Known issues — not fixed in this release

- `npm audit` still reports a HIGH advisory in `zod` (< 4.6.6). The fix is
  4.6.7, a **major** upgrade that changes the API. It needs a deliberate
  decision and a separate pass over every `zod` schema in the codebase.
- The rate limiter is per-instance and in-memory. It is a speed bump, not a
  distributed control; a multi-instance deployment needs a shared store.
- Tenancy is enforced in application code, not by Postgres row-level security.
  Every query must keep its `user_id` scope — a missing `.eq()` is a data leak.
  See the runbook for the audit query that finds unscoped queries.
- `damages` and `quotations` exist only in `supabase-setup/10-holy-grail.sql`,
  not in `db/migrations/`. A fresh core-only install does not have them.
- Encryption at rest is implemented and tested but **not yet applied to the
  live data**. The backfill has to run, and the read/write call sites have to be
  converted. The dashboard also has to stop reading sensitive columns from the
  browser first — that is PHASE 0 in the runbook, and it is blocking: until it
  is done, encryption would render `v1:…` in the UI.
- The public legal and marketing copy still contains claims the product does not
  implement: row-level security on every table, three data-residency regions,
  an account-deletion control, an audit log, login rate limiting, Airtel Money
  as a payment method, and fabricated customer case studies, download counts,
  vote counts, changelog releases and status incidents. These need a product
  decision — see `audit/findings/features.json`.
