# Independent findings — owner-side verification pass

These were found by a separate manual pass over the codebase, not by the five
audit tracks. They exist so the fixing stage does not miss anything the tracks
overlooked, and so over-claims get caught. Every line reference was opened and
read directly.

Read this file in addition to `audit/findings/*.json`.

---

## IND-001 — CRITICAL — SQL injection via attacker-controlled column names in backup restore

**Status: FIXED** — `lib/backup.ts` now validates every row key against a strict identifier pattern AND against the table's real column list before any SQL is built, on all three insert branches. An unknown or unsafe column rejects the whole restore in a pre-flight pass. Regression tests: `lib/backup.security.test.ts` (27 assertions).

**Where**
- `lib/backup.ts` → `neonDb.insert(...)`, the three `sql.unsafe(...)` calls that
  build the column list from `Object.keys(safe)`
- `lib/system.ts:118` → `data: z.record(z.string(), z.array(z.record(z.any())))`
- Reachable at `POST /api/backup/import` (`app/api/backup/import/route.ts`)

**Mechanism**
`BackupPayloadSchema` allows arbitrary row keys — `z.record(z.any())` puts no
constraint on the *names*. `sanitiseRow()` (lib/system.ts:145) only removes a
fixed set of secret-looking column *values*; it never validates column *names*.

`lib/backup.ts` then builds raw SQL by string-interpolating those attacker-
controlled names as quoted identifiers:

```ts
`insert into public.${table} (${Object.keys(safe).map((k) => `"${k}"`).join(",")})
 values (${Object.keys(safe).map((_, i) => `$${i + 1}`).join(",")})
 on conflict do nothing`
```

A `"` inside a key terminates the quoted identifier early. The table name is
allowlisted (`BACKUP_TABLES`, lib/system.ts:22) and the row is re-stamped with
`user_id`, so the *table* is safe — the *columns* are not.

**Verified generated SQL** (reproduced with the exact template from `lib/backup.ts`):

```
key:   'name") values (($1::text || (select current_user))) --'
result:
insert into public.properties ("name") values (($1::text || (select current_user)))
  --") values ($1) on conflict do nothing
params: ["payload"]
```

The `--` comments out the remainder. What Postgres actually executes is
`insert into public.properties ("name") values (($1::text || (select current_user)))`
— one column, one value, one bound parameter. Valid.

**Impact**
Any authenticated user (a normal landlord account) can execute arbitrary SQL in
the application database. The injected value is written into a row the attacker
owns, and the normal properties API returns it — so it is a full read-and-write
exfiltration primitive, not just blind. The `on conflict do update set` branch
interpolates the same keys, so `replace`/`merge` modes are equally exposed.
Stacked statements and DDL are worth testing in the fix verification.

**Fix direction**
- Validate every row key against the real column set of the target table before
  building SQL, and reject anything that is not an exact match. A per-table
  column allowlist derived from the schema is the robust version; a strict
  `/^[a-z_][a-z0-9_]*$/` identifier test is the minimum.
- Never interpolate identifiers. If the driver supports an identifier-quoting
  helper, use it; otherwise build the statement only from validated names.
- Apply the same validation on every insert branch (skip / replace / merge).

---

## IND-002 — MEDIUM — timing-unsafe secret comparisons

**Status: FIXED** — new `lib/api/secure-compare.ts` exports `timingSafeEqualString()` (length-guarded `crypto.timingSafeEqual`), wired into the migration, cron and auto-backup endpoints. The fail-closed behaviour is unchanged.

**Where** (all `got === expected` on a shared secret)
- `app/api/migrations/run/route.ts:49` → `MIGRATION_SECRET`
- `app/api/migrations/reset/route.ts:45` → `MIGRATION_SECRET`
- `app/api/migrations/rollback/route.ts:38` → `MIGRATION_SECRET`
- `app/api/cron/run/route.ts:32` → `CRON_SECRET`
- `app/api/mpesa/callback/route.ts` → `MPESA_CALLBACK_SECRET`
- `app/api/backup/auto/route.ts` → `BACKUP_CRON_SECRET`

**Impact** low-to-moderate on its own (network jitter usually dominates), but it
is a standard hardening item and the fix is trivial. Use `crypto.timingSafeEqual`
with a length guard — `timingSafeEqual` throws on unequal lengths, so compare
`Buffer.byteLength(a) === Buffer.byteLength(b)` first.

---

## IND-003 — VERIFIED GOOD (do not over-claim) — migration endpoints fail closed

**Status: VERIFIED GOOD (unchanged)** — the endpoints still fail closed in production; only the comparison became timing-safe.

`app/api/migrations/run|reset|rollback/route.ts` all check the secret and
**return 503 in production when the secret env var is unset**, and 403 when it
is set but the header does not match. The dev-only fallback to "any signed-in
user" is gated on `NODE_ENV !== "production"`.

**Do not report these as unauthenticated destructive endpoints.** The remaining
real issues are IND-002 (timing) and IND-006 (below).

---

## IND-004 — VERIFIED GOOD — Stripe webhook is correctly verified

**Status: VERIFIED GOOD (unchanged)**

`app/api/stripe/webhook/route.ts` reads the raw body with `await req.text()`,
verifies it via `getStripe().webhooks.constructEvent(payload, signature, secret)`,
rejects on failure, records the event id for idempotency, and scopes the writes
with `.eq("user_id", userId)` where `user_id` comes from the signed event
metadata. This is the right shape. Any finding claiming the Stripe webhook is
unverified is wrong.

---

## IND-005 — VERIFIED GOOD — core CRUD is tenant-scoped

**Status: VERIFIED GOOD (unchanged)**

`app/api/properties/[id]/route.ts` scopes GET, PUT and DELETE with
`.eq("id", params.id).eq("user_id", userId)`. `lib/api/with-db-auth.ts` enforces
`getUser()` server-side, and `lib/api/index.ts` (`withAuth`) adds a same-origin
check on every mutating verb plus a generic production error message.

The tenancy model is sound in the places that matter most. The risk is
concentrated in the paths that bypass the usual helpers — which is exactly where
IND-001 sits.

---

## IND-006 — MEDIUM — cron and migration endpoints open when NODE_ENV is not "production"

**Status: OPEN** — the endpoints still open when `NODE_ENV` is not `production`. This is deliberate for the developer's convenience, but it means a staging deployment with production-like env vars is open. The owner must confirm that the production deployment sets `NODE_ENV=production`.

`app/api/cron/run/route.ts` only enforces `CRON_SECRET` when
`process.env.NODE_ENV === "production"`. A staging or self-hosted deployment
that forgets `NODE_ENV=production` leaves `POST /api/cron/run` fully open, and
`?migrate=1` on it will run pending migrations. The same pattern gates the
migration routes' signed-in fallback.

**Fix direction** — gate on an explicit `ALLOW_DEV_ADMIN` opt-in instead of
`NODE_ENV !== "production"`, so the default is closed.

---

## IND-007 — MEDIUM — `throwUnlessMissingTable` hides broken features

**Status: OPEN** — `throwUnlessMissingTable` still swallows missing-table errors. Not changed in this pass because the callers rely on it to degrade gracefully when the optional tables are absent. It is listed as a residual risk in the runbook.

`lib/api/index.ts:109` swallows any error that looks like "relation does not
exist" and returns as if nothing happened. That is how a dashboard query against
a table that was never created renders an empty list instead of an error. This
directly produces the "half-done feature" symptom the owner is reporting —
the page looks fine and is silently empty.

**Fix direction** — keep the tolerance for genuinely optional tables, but make
it visible: log at warn level with the table name, and surface a "database setup
incomplete" state in the UI instead of an empty table.

---

## IND-008 — MEDIUM — type errors are shipped silently

**Status: PARTIAL** — the flag is still set in `next.config.mjs`, because removing it before the remaining errors are cleared would break the build outright. What changed: the error count is now known and documented (`audit/baseline/tsc-baseline.log`, 54 at baseline, 52 now), the count is checked in CI independently of the build, and the build no longer hides *new* errors silently in practice. Turning the flag off is a separate, mechanical cleanup of the 52 remaining errors listed in the baseline log.

`next.config.mjs` sets `typescript.ignoreBuildErrors: true`, and the baseline
`npx tsc --noEmit` reports **54 pre-existing errors**. Errors cluster in
`app/api/templates/[id]/preview/route.ts` (16), `app/dashboard/damages/page.tsx`
(10, all implicit `any`), `app/api/stripe/webhook/route.ts` (6) and
`app/api/paybill/route.ts` (5). The `any` cluster in `damages/page.tsx` is
consistent with the page being scaffolded and never finished.

**Fix direction** — clear the 54, then remove `ignoreBuildErrors` so the build
fails on type errors again.

---

## IND-009 — LOW — the test suite does not run from a clean install

**Status: FIXED** — `vite` was added as a dev dependency (vitest 5 requires it as a peer dependency) and `vite.config.mts` was added so the `@/` alias resolves inside vitest. The suite now runs from a clean install.

`package.json` declares `vitest 5.0.1` but not `vite`, which vitest 5 requires
as a peer dependency. A clean `npm install` then `npm test` fails with
`Cannot find package 'vite'`. `vite` has been added to `devDependencies` in this
working copy so the suite runs; the upstream `package.json` should carry it.

---

## IND-010 — MEDIUM — `next.config.mjs` has no Content-Security-Policy

**Status: FIXED** — a Content-Security-Policy was added and the HSTS header was hardened. See the storage/infra deliverable for whether it ships in report-only mode and how to switch to enforcing.

The `headers()` block sets `X-Content-Type-Options`, `Referrer-Policy`, HSTS,
`Permissions-Policy` and `X-Frame-Options`, but there is **no CSP at all**.
Combined with `images.unoptimized: true` and any `dangerouslySetInnerHTML`
usage, that is the missing layer in front of XSS. HSTS also lacks
`includeSubDomains` and `preload`.
