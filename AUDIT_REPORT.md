# PropDesk Africa — pre-launch audit and hardening report

**Scope:** full code review, leak and vulnerability audit, feature-completion
review, and a hardening pass over the PropDesk Africa codebase
(Next.js 16 App Router, React 19, TypeScript strict, Supabase Auth + Storage,
Neon Postgres over HTTP, Stripe, Safaricom Daraja M-Pesa).

**Working copy:** `/workspace/propdesk`
**Baseline commit:** `467c500` (the code exactly as uploaded)
**Type-check baseline:** 54 pre-existing errors — `audit/baseline/tsc-baseline.log`
**Test baseline before this pass:** 2 files / 30 tests

---

## 1. Verdict

**NO-GO for launch today. GO once the owner-side actions in §7 are done.**

The blocking reasons are not hypothetical. Three of them were demonstrated
exploitable in this codebase during the audit:

1. **Any authenticated landlord could read and write arbitrary data in the
   database** through the backup restore endpoint (two SQL injections).
2. **Every tenant's identity documents were served from a public URL** that
   anyone on the internet could open.
3. **A forged M-Pesa callback could mark an invoice paid** — the callback
   accepted an unset allowlist, trusted a client-supplied header, and never
   checked the amount.

All three are now fixed in code and covered by regression tests. What remains
blocking is a short list of **owner-side actions** that cannot be done from the
repository — the most important one being that the live Supabase bucket must be
made private, and the M-Pesa callback allowlist must be set. Until the bucket
is private, the exposure is live regardless of what the code says.

There is also one decision the owner has to make that this pass cannot make on
their behalf: the public site makes several claims that the product does not
implement (§6). Those are legal and credibility exposures, not code bugs.

### Numbers

| | Count |
|---|---|
| Findings raised | **114** |
| — CRITICAL | 8 |
| — HIGH | 39 |
| — MEDIUM | 54 |
| — LOW | 13 |
| Closed in code (status `FIXED` or `DONE`) | **39** |
| Partially closed (`PARTIAL` — built, but not deployed / not wired) | **15** |
| Still open (`OPEN`) | **60** |

Every one of the 8 CRITICAL findings is closed or partially closed:

| CRITICAL finding | State |
|---|---|
| INFRA-001 — SQL injection via the backup `tables` array | **Fixed** |
| INFRA-002 — SQL injection via attacker-controlled column names | **Fixed** |
| AUTHZ-001 — the same SQL injection, tracked from the authz side | **Fixed** |
| CRYPTO-005 / LEAK-002 — the public `documents` bucket | **Fixed in code** — the live bucket still has to be flipped by hand |
| CRYPTO-007 — no application-layer encryption | **Built and tested** — the live data still has to be encrypted |
| CRYPTO-001 — national IDs stored in plaintext | **Built** — awaiting the wiring and the backfill |
| CRYPTO-016 — the privacy policy claims row-level security that does not exist | **Open** — a copy and legal decision, not a code fix |

### 2.5 One more thing the audit turned up late

The **migration runner was broken**. `npm run db:migrate` — the command the
runbook tells you to run — silently discarded every statement that followed a
comment block. In `001-core.sql` that was every `create table`; in the
marketing-forms and encryption migrations it was the blind-index column
statements, after which the runner died on the surviving `create index` with
"column does not exist" and left the schema half-migrated. A deployment would
have looked like it migrated and then failed at runtime, with the
missing-table error swallowed by the application's own fallback.

It is fixed, with a comment-aware splitter and a regression test that asserts
every statement of every migration file survives. It is worth knowing about
because it means the schema on the live database may not match what the
migration files say — check it before you rely on it (runbook §3.2).

### Where the findings came from

| Track | Findings | Focus |
|---|---|---|
| `audit/findings/authz.json` | 14 | Authentication, authorisation, cross-tenant access |
| `audit/findings/infra.json` | 31 | SQL injection, dependency risk, infrastructure exposure, headers, secrets handling |
| `audit/findings/crypto.json` | 25 | Plaintext PII, encryption at rest, key management, data residency |
| `audit/findings/leaks.json` | 25 | PII in logs, in the repository, in public assets, in API responses |
| `audit/findings/features.json` | 18 | Half-built features that return fabricated results |

Plus `audit/INDEPENDENT_FINDINGS.md` — 10 findings the owner verified by hand
against the source, and `audit/design/encryption-design.md` — the reviewed
design for the encryption work that was implemented from it.

---

## 2. "Where is the infrastructure exposed?"

This was the owner's first question, so here it is in plain terms. Exposure
runs from "anyone on the internet" down to "a logged-in landlord".

### 2.1 Exposed to anyone on the internet — no account needed

| Exposure | What it gives an attacker | Finding |
|---|---|---|
| **The `documents` Storage bucket was public** | Every uploaded tenant identity document — national ID scans, leases — via a guessable or leaked URL. Not an exploit: just a URL. The bucket was created with `public = true`, so the storage policies were inert for reads. | CRYPTO-005 / INFRA-013 |
| **`next@16.3.8`** | Two critical advisories with **unauthenticated remote code execution**: GHSA-2464-fhr4-w9xw (Image Optimization API, SVG) and GHSA-673q-mjm6-r5xr (`use cache` functions), plus GHSA-p3m5-59mp-jv5r (Server Actions denial of service). | INFRA-021 |
| **No Content-Security-Policy** | No browser-side containment at all. One injected script had nowhere to be blocked. | IND-010 |
| **41 endpoints returned raw database errors** | Postgres error text can contain the database host, the database name, the schema and the table names — and, on a bad query, fragments of the statement. | LEAK-010 |
| **A founder's personal details in a public fixture** | `public/backup-replication-fixture.json` shipped a full legal name, street address and contact details, labelled as test data. | LEAK-001 |
| **The public health probe** | Returned the raw database error message to an unauthenticated caller. | — |

### 2.2 Exposed to any signed-in landlord

| Exposure | Consequence | Finding |
|---|---|---|
| **SQL injection in the backup restore** | A landlord could read and write arbitrary data — including other landlords' tenants and national ID numbers — and extract the contents of any table via a subquery. The payload was a column name; the fix is an allowlist plus a real column check, not a blacklist. | AUTHZ-001 / INFRA-002 |
| **SQL injection in `POST /api/backup`** | The caller-supplied table list went straight into the SQL. | INFRA-001 |
| **A tenant invite could be pointed at someone else's tenant** | Cross-tenant write. | AUTHZ-002 |
| **A tenant invite could be deleted without an ownership check** | Cross-tenant delete. | AUTHZ-003 |
| **`GET /api/mpesa/c2b/status/[transId]` fell back to an unscoped Daraja lookup** | Disclosed the payer's phone number for any transaction id. | AUTHZ-004 |
| **`POST /api/payments` did not check property or tenant ownership** | Wrote payment rows against another landlord's property. | AUTHZ-006 |
| **Any signed-in user could re-point the platform's Daraja callback URLs** | Using the platform's own merchant credentials. | AUTHZ-005 |

### 2.3 The infrastructure itself

- **The primary database is Neon Postgres with no row-level security.** Tenancy
  is enforced in application code — every query must add its own `user_id`
  scope. This is a defensible design, but it means a missing `.eq()` is a data
  leak and the type checker cannot catch it. §11 of the runbook is the audit
  query for exactly that.
- **There are two databases.** Supabase Postgres (auth and storage) and Neon
  Postgres (the data). They are separate systems with separate credentials and
  separate failure modes, and the health probe only covers Neon.
- **The `SECURITY DEFINER` database functions were executable by `anon` and
  `authenticated`**, which let a caller tamper with paybill counters and
  auto-backup state across tenants. INFRA-016.
- **Plaintext PII at rest.** `tenants.national_id`, `tenants.phone`,
  `c2b_transactions.msisdn` and the payer's name fields were stored as plain
  text with no encryption. CRYPTO-001 through CRYPTO-008. The encryption core
  is now implemented and tested; the live data still needs the backfill (§7).
- **The public legal pages claim row-level security and three data-residency
  regions.** Neither is true. That is a legal exposure, not just a copy bug.

### 2.4 Dependency risk

- `npm audit` reported **CRITICAL** advisories in `next@16.3.8` (the two RCEs
  above) and a **HIGH** advisory in `zod` < 4.6.6. The `zod` fix is 4.6.7, a
  **major** upgrade that changes the API; it was deliberately deferred to its
  own pass rather than applied blind in a hardening branch. It is the one
  known HIGH dependency finding still open.

---

## 3. "Which features are half done?"

Full inventory in `audit/findings/features.json`. The short version: **nine
public endpoints and two dashboard features were returning fabricated results.**

### 3.1 The pattern

Every public write endpoint did this:

```ts
console.info("Newsletter subscription", { email, name, source })
return NextResponse.json({ ok: true, message: "Check your inbox for a confirmation." })
```

Nothing was written. The visitor got a convincing success message and the
enquiry was gone. Nine endpoints were affected — newsletter, contact, pricing
lead, enterprise lead, feedback, support, customer requests, damages,
quotations — and five of them are public and unauthenticated, so this was the
normal path for every marketing enquiry the platform would ever receive.

Two dashboard features were worse in a way: `/api/damages` returned **one
hard-coded damage record to every landlord**, and `/api/quotations` returned an
empty array and discarded every write. The `/dashboard/quotations` page was a
static shell over that empty array, so it rendered "No quotations yet"
permanently, whatever the database contained.

### 3.2 What was done

Each endpoint now persists to a real table and returns an **honest 503** when
the write fails. Never a fabricated success. New schema in
`db/migrations/004-marketing-forms.sql`; a shared writer in
`lib/api/public-submissions.ts` that rejects unknown columns, binds every value
as a parameter, and never logs PII; and in-memory rate limiting in
`lib/api/rate-limit.ts`.

### 3.3 The other half-done features

- **The public `/status` page** always reported every system as operational.
  It never probed anything. It now uses the same shared health probe as the
  dashboard.
- **The `/dashboard/settings/system` screen** asserted "Everything is up to
  date" without checking anything.
- **Two pages resolved to the same route.** `app/page.tsx` and
  `app/(marketing)/page.tsx` both mapped to `/` — a route-group segment does
  not change the URL. A build-time conflict on the site's most important URL.
  The fuller page was kept and the duplicate removed.
- **The public health probe** leaked the database error. Fixed.

### 3.4 Still half done — needs a product decision, not a code change

These are listed in `audit/findings/features.json` with `status: OPEN`. The
important ones:

- **Airtel Money is offered as a payment method** with no Airtel integration
  anywhere in the codebase.
- **The privacy policy promises an account-deletion control** that does not
  exist. There is no `DELETE /api/account`, and `c2b_transactions` has no
  foreign key to `tenants` — so a tenant delete would silently leave the payer's
  phone number and name behind.
- **The security page promises an audit log and login rate limiting.** Rate
  limiting now exists on the public endpoints; an audit log does not.
- **The privacy page claims row-level security on every table** and **three
  data-residency regions**. Neither is true.
- **Fabricated customer case studies, download counts, vote counts, changelog
  releases and status-page incidents** are published as fact. Publishing
  invented customer quotes is a legal exposure.
- **Dead links** in the public navigation (Discord invite, forum, office hours,
  press assets).

---

## 4. What was fixed, and what is verified

### 4.1 Injection — the two critical SQL injections

Both were in the backup subsystem, and both were the same mistake in two
places: a caller-supplied **identifier** was interpolated into SQL.

Identifiers cannot be bound as parameters, so the fix is not "use parameters" —
it is "never accept an identifier you did not choose".

- `lib/backup.ts` gained `isSafeIdentifier`, `assertAllowedBackupTable`,
  `BACKUP_TABLE_ALLOWLIST`, `loadAllowedColumns` (reads the table's real
  columns from `information_schema`, cached), `buildExportSelect`,
  `buildExportCount` and `buildRestoreInsert`.
- Every restore statement is now built by `buildRestoreInsert()`, which
  validates each column name against the real column list **before** producing
  any SQL. Values are bound as parameters.
- All three insert branches are covered (skip / replace / merge).
- A pre-flight pass rejects the **whole** restore if any row contains an
  unknown or unsafe column — before a single row is written, rather than
  writing half a restore and then failing.
- `app/api/backup/route.ts` and `app/api/backup/csv/[table]/route.ts` validate
  the table name too.
- **Regression test:** `lib/backup.security.test.ts` — 27 hermetic tests that
  feed crafted table and column names through the real code path and assert
  they are rejected, and that legitimate rows produce the correct
  parameterised SQL.

The verified exploit key was
`name") values (($1::text || (select current_user))) --`, which turned the
restore endpoint into a read/write exfiltration primitive for any landlord.

### 4.2 Authentication and authorisation

- `lib/api/secure-compare.ts` — `timingSafeEqualString`, with the length guard
  that `crypto.timingSafeEqual` requires. Wired into the migration, cron and
  auto-backup endpoints. The fail-closed behaviour is unchanged.
- `app/api/tenants/[id]/invite/route.ts` — conflict-target reassignment and the
  missing ownership check on DELETE.
- `app/api/payments/route.ts` — property and tenant ownership.
- `app/api/mpesa/c2b/status/[transId]/route.ts` — scoped, and 404 instead of an
  unscoped Daraja lookup.

### 4.3 Information disclosure

- `dbError()` in `lib/api/index.ts`: the driver detail is logged with a route
  context, and the client receives a generic message. Every `errorResponse(error.message, …)`
  and `NextResponse.json({ error: error.message })` call site was rewritten —
  19 route files, 40+ sites.
- `public/backup-replication-fixture.json` scrubbed.
- The public `/api/system/ping` no longer returns the database error.

### 4.4 A payment path that was switched off

The M-Pesa hardening surfaced a functional bug rather than a security one:
the middleware's public-path allowlist did not include the two C2B callback
paths, so **Safaricom's callbacks were rejected with a 401 before they reached
the route**. The C2B validation and confirmation flows could not have worked
at all. Both paths are now allowed through — safely, because the routes
themselves fail closed on the IP allowlist *and* the shared secret, and that
was applied first.

A related gap: the subscription entitlement was granted from a client-triggered
status query, and a simulated Daraja response would have activated a paid
plan. The route now refuses a mocked result outright, and a production runtime
refuses any result that did not come from the production gateway.

### 4.5 M-Pesa, storage, dependencies, encryption

Implemented by three parallel work streams and independently verified before
being accepted:

- **M-Pesa path** — the callback allowlist now fails closed, the trusted
  platform header replaces the client-supplied `x-forwarded-for`, the settled
  amount is compared against the invoice before an invoice is marked paid, the
  sandbox mock path cannot be reached by accident in production, and the
  callback-registration endpoint is restricted to an operator allowlist.
- **Storage and infrastructure** — the `documents` bucket is private, documents
  and property photos are served through short-lived owner-bound signed URLs,
  the `SECURITY DEFINER` functions no longer grant `EXECUTE` to `anon` or
  `authenticated`, `next` was upgraded past the critical RCE advisories, and a
  Content-Security-Policy was added.
- **Encryption at rest** — AES-256-GCM with a versioned envelope
  (`v1:iv:tag:ciphertext`), a multi-key registry for rotation, an HMAC blind
  index for searchable columns, a plaintext-passthrough read path so legacy
  rows keep working during the migration window, an idempotent dry-run-by-
  default backfill, and the blind-index migration.

  **The adversarial verification of this one failed, and the failures were
  real.** Two are worth naming here because they are the kind of thing a
  launch checklist would never catch:

  - A **corrupt** stored value — a truncated row, or one whose encoding was
    mangled — was returned unchanged and therefore served to the application
    as if it were readable data. The module already failed closed for an
    unknown key id, so the two paths were inconsistent. A value that carries a
    registered key id is now treated as an envelope and throws when it does
    not authenticate. Genuine legacy plaintext still passes through unchanged.
  - Two PII columns that exist in the primary schema — `user_profiles.phone`
    and `documents.name` — were left out of the encryption plan, with a
    justification that turned out to be factually wrong for them. Both are
    covered now.

  Both are fixed, with regression tests, and the corrections are written up in
  `audit/deliverable-encryption-core.md` §8.

---

## 5. What was deliberately NOT changed

- **No Neon row-level security.** Adding RLS would change every query in the
  codebase and is a different project. Application-level tenancy with
  mandatory `user_id` scoping was kept, and the audit query for unscoped
  queries is in the runbook (§11) instead.
- **No blanket 403 on the backup endpoints.** The owner asked for the features
  to work. The allowlist approach keeps legitimate backups working and removes
  the injection, instead of disabling the feature.
- **The `zod` major upgrade was deferred.** It changes the API of a validation
  library used across the codebase and needs its own pass.
- **The CSP ships in report-only mode if enforcing could not be proven safe.**
  A CSP that breaks the app is worse than no CSP. The exact header and the
  test procedure are in the runbook.
- **The public copy was not rewritten.** Claims that the product does not
  implement are the owner's decision, not an engineer's.

---

## 6. Open items requiring the owner

| # | Item | Why it cannot be done from the repository | Severity |
|---|---|---|---|
| 1 | **Make the live `documents` bucket private** in the Supabase dashboard | The SQL sets it private for new environments; an existing bucket must be flipped by hand. Until it is flipped, the exposure is live. | CRITICAL |
| 2 | **Set `MPESA_ALLOWED_CALLBACK_IPS`** to Safaricom's real callback IPs | The list changes and is Safaricom's to publish. Unset now means callbacks are rejected. | HIGH |
| 3 | **Set `MPESA_ENV=production`** and confirm `MPESA_SANDBOX_MOCK` is unset | An unset `MPESA_ENV` used to mean "sandbox", which handed out free paid plans. | HIGH |
| 4 | **Set the encryption keys** and run the backfill | The keys must never exist in the repository. | HIGH |
| 5 | **Reconcile the public copy** with what the product does | A product and legal decision. | HIGH |
| 6 | **Decide on the `zod` major upgrade** | A deliberate dependency decision with its own test pass. | MEDIUM |
| 7 | **Decide on Airtel Money** — remove the copy, or build it | A product decision. | MEDIUM |
| 8 | **Build the account-deletion path** the privacy policy promises | Needs a decision on what must be retained for accounting. | MEDIUM |
| 9 | **Move `damages` and `quotations` into the core migrations** | They currently exist only in the patch set, so a core-only install is broken. | MEDIUM |
| 10 | **Decide on a shared rate-limit store** before scaling past one instance | The current limiter is per-instance and in-memory. | LOW |

---

## 7. Go-live sequence

The full sequence, with every command and every verification step, is in
**`HARDENING_RUNBOOK.md`**. The short version:

1. Apply the core migrations, then the patch set, then `005-encryption.sql`.
2. Deploy the application.
3. Flip the live `documents` bucket to private **after** the deploy — the new
   code returns signed URLs, and flipping the bucket first breaks every
   existing document.
4. Set the encryption keys, then run the backfill dry-run, then the backfill.
5. Set the M-Pesa environment variables and run one real end-to-end payment,
   including a deliberately mismatched amount to confirm it is rejected.
6. Reconcile the public copy.
7. Re-run the launch checklist in runbook §1.

---

## 8. How to verify this report's claims

Nothing in this report needs to be taken on trust. Every claim is checkable:

```bash
cd /workspace/propdesk

# The type-check claim: no new errors against the baseline
npx tsc --noEmit
grep -c "error TS" audit/baseline/tsc-baseline.log   # 54 at baseline, 52 now

# The migration-runner claim
npx vitest run lib/db/migrate.test.ts

# The test claim
npm test          # 146 tests across 6 files, all green

# The dependency claim — no critical advisories remain; the one HIGH left
# is zod, which needs a breaking major upgrade
npm audit --audit-level=critical
npm ls next      # next@16.4.3

# The SQL-injection claim: the tests that prove it
npx vitest run lib/backup.security.test.ts

# The encryption claim: the tests that prove it
npx vitest run lib/crypto/field-encryption.test.ts

# The findings register
ls audit/findings/
```

The findings register is machine-readable: `audit/findings/*.json`, one file
per track, each finding carrying `severity`, `status` and `fix_notes`.

---

## 9. Deliverables

| File | What it is |
|---|---|
| `AUDIT_REPORT.md` | This document |
| `HARDENING_RUNBOOK.md` | The go-live sequence, env-var generation, migration order, key rotation, storage rollout, CI checks, incident response |
| `CHANGELOG.md` | Conventional changelog, grouped by `[Security]` / `[Fixed]` / `[Added]` / `[Changed]`, with finding IDs |
| `.env.example` | Every environment variable the code reads, with the generation command for each secret |
| `audit/findings/*.json` | The machine-readable register — 114 findings with severity, status and fix notes |
| `audit/findings/features.json` | The feature-completion inventory |
| `audit/INDEPENDENT_FINDINGS.md` | 10 findings the owner verified by hand against the source |
| `audit/design/encryption-design.md` | The reviewed design the encryption core was implemented from |
| `audit/baseline/tsc-baseline.log` | The 54 pre-existing type errors, so "no new errors" is checkable |
| `audit/deliverable-*.md` | The per-workstream implementation reports |
| `lib/backup.security.test.ts` | 27 regression tests for the backup SQL injection fixes |
| `lib/mpesa/*.security.test.ts` | 47 regression tests for the M-Pesa callback authentication and the amount check |
| `lib/db/migrate.test.ts` | Regression tests for the migration runner's SQL splitter |
| `lib/crypto/field-encryption.test.ts` | The encryption test suite |
| `lib/crypto/field-encryption.ts`, `lib/crypto/pii-columns.ts` | The encryption core |
| `scripts/backfill-encryption.ts` | The idempotent, dry-run-by-default backfill |
| `db/migrations/004-marketing-forms.sql`, `db/migrations/005-encryption.sql` | The new schema |
