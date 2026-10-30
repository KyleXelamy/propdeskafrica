# Infrastructure Exposure, Hardening Posture and Data-Plane Attack Surface

**Track:** `audit-infra` · **Scope:** `/workspace/propdesk` (Next.js 16 App Router on Vercel, Neon Postgres over HTTP, Supabase auth + storage, Stripe + Safaricom Daraja)
**Findings:** 31 — 2 CRITICAL, 8 HIGH, 18 MEDIUM, 3 LOW · **Machine-readable:** `audit/findings/infra.json`
**Method:** read-only. Every route handler under `app/api/**`, the middleware and auth helpers, the Neon/Supabase data layers, the storage layer, the Daraja client, the Supabase DDL in `supabase-setup/*.sql`, `next.config.mjs`, and `npm audit`. No application source was modified.

---

## Executive summary — where the infrastructure is exposed

The owner asked "cases where we have exposed our infrastructure". The exposure is not in the marketing pages; it is in five specific places:

1. **The backup subsystem is a raw-SQL execution surface.** `POST /api/backup` interpolates a caller-supplied `tables` array into a `sql.unsafe()` statement (INFRA-001) and `POST /api/backup/import` interpolates caller-supplied *column names* into an `INSERT` (INFRA-002). Both are reachable by any registered landlord with a `curl` and a spoofed `Origin` header. This is the launch blocker.
2. **The money paths authenticate against the environment, not against money.** The M-Pesa C2B callbacks trust an IP allowlist that fails open when unset (INFRA-004), the STK callback reads a client-controllable `x-forwarded-for` (INFRA-005), the settled amount is never compared to the invoice (INFRA-006), and with `MPESA_ENV` left at its default the subscription flow approves itself (INFRA-007).
3. **Tenant documents are in a public bucket.** The `documents` bucket is created with `public = true` and the schema comment claims the per-user storage policies still scope it — for a public bucket they do not (INFRA-013).
4. **Two `anon`-callable `SECURITY DEFINER` RPCs let an unauthenticated caller tamper with a landlord's paybill counters and let any user delete another tenant's backups** (INFRA-016).
5. **The framework and validation libraries are inside published advisory ranges** — `next@16.3.8` (2 critical RCE, 1 high DoS) and `zod@3.25.76` (high, memory exhaustion) (INFRA-021, INFRA-022).

The good news is worth recording: the Stripe webhook is correctly signed against the raw body, the migration/cron/backup-admin secrets **are** genuinely required and fail closed in production, the M-Pesa callback secret **is** compared in constant time, there is no SSRF (no route ever fetches a user-supplied URL), and the core CRUD is consistently scoped by `user_id`.

---

## 1. Route exposure

**89 route handlers under `app/api/**`**, plus `app/rss.xml/route.ts` and `app/(marketing)/auth/callback/route.ts`.

| Class | Count | Enforcement |
|---|---|---|
| **Authenticated** (`withAuth` / `withDbAuth` / server-side `getUser()`) | 51 | `lib/api/index.ts:29-61` — session check + same-origin check on every mutating verb |
| **Public-by-design** (no auth check of their own in the route) | 31 | middleware catch-all only — see INFRA-008 |
| **Admin/internal** (secret- or signature-gated) | 7 | `MIGRATION_SECRET` ×3, `CRON_SECRET`, `BACKUP_CRON_SECRET`, `MPESA_CALLBACK_SECRET`, `STRIPE_WEBHOOK_SECRET` |

The two auth mechanisms do **not** agree, and the mismatch runs in both directions — see INFRA-008. Classification is by the enforcement the route itself contains; the effective posture of the 31 "public" routes depends entirely on the middleware.

### 1.1 The endpoints the brief asked about

| Endpoint | Real posture | Finding |
|---|---|---|
| `app/api/migrations/run` | `MIGRATION_SECRET` required, **503 if unset in production**, header-only, `===` compare | INFRA-003, INFRA-030 |
| `app/api/migrations/reset` | same pattern | INFRA-003, INFRA-030 |
| `app/api/migrations/rollback` | same pattern; runs a rollback `.sql` file with `sql.unsafe()` | INFRA-003, INFRA-030 |
| `app/api/cron/run` | `CRON_SECRET` required in production; `?migrate=1` also runs migrations | INFRA-003, INFRA-023 |
| `app/api/system/*` | **no auth at all in the route** — public metadata | INFRA-009 |
| `app/api/backup/*` | `withAuth` except `/backup/auto` (secret) | INFRA-001, INFRA-002, INFRA-024 |
| `app/api/export` | `withAuth`, correctly scoped by `user_id` | — |
| `app/api/backup/csv/[table]` | `withAuth` + **allowlist** — the one place it is done right | — |
| `app/api/reconciliation/bulk` | `withAuth`, user-scoped, parameterised | — |

**Secret handling: the answers to the brief's specific questions.**

- Are `MIGRATION_SECRET` / `CRON_SECRET` / `BACKUP_CRON_SECRET` *actually required*, or only mentioned in a comment? **Actually required.** Every one of the five sites returns `503` in production when the env var is unset (`app/api/migrations/run/route.ts:36-47`, `app/api/cron/run/route.ts:23-25`, `app/api/backup/auto/route.ts:28-36`). The dev fallback to "any signed-in user" is gated on `NODE_ENV !== "production"`. They are **not** merely in a comment.
- Are they compared in constant time? **No** — `got === expected` / `got !== secret` at all five sites (INFRA-003). The codebase already has the correct pattern at `app/api/mpesa/callback/route.ts:34` (`timingSafeEqual` with a length guard); it was simply not applied here.
- Is a secret accepted via query string? **No.** A repository-wide search for `searchParams.get("secret"|"token"|"key"|"password")` returns nothing. All three admin secrets are read from `x-migration-secret`, `x-cron-secret` or `Authorization: Bearer …` headers. This part is done correctly.

### INFRA-001 — CRITICAL — SQL injection — unvalidated `tables` interpolated into raw Neon SQL

- **File:** `app/api/backup/route.ts:26-39` (sink `lib/backup.ts:31, 42`)
- **Evidence**
  ```ts
  // app/api/backup/route.ts:26-39
  const body = (await request.json().catch(() => null)) as {
    label?: string
    tables?: string[]
    ...
  } | null
  ...
  const payload = await exportBackup(userId, email, {
    tables: body?.tables,          // ← no allowlist, no zod
  })
  ```
  ```ts
  // lib/backup.ts:187
  const tables = opts.tables && opts.tables.length > 0 ? opts.tables : [...BACKUP_TABLES]
  // lib/backup.ts:31
  const rows = await (sql as any).unsafe(`select * from public.${table} where ${keyCol} = $1`, [userId]) as any[]
  ```
  The sibling route **does** allowlist — `app/api/backup/csv/[table]/route.ts:13`:
  ```ts
  if (!table || !(BACKUP_TABLES as readonly string[]).includes(table)) { … 400 }
  ```
- **Impact:** any authenticated landlord can inject arbitrary SQL into a raw Neon statement and read the rows back — the payload is echoed in the response at `app/api/backup/route.ts:92`. That is cross-tenant exfiltration of every table in the database (other landlords' properties, tenants, payments, `user_profiles`) plus whatever write/DDL the Neon role may perform. The `withAuth` same-origin check is not a barrier: the attacker sets `Origin: <host>` on the request.
- **Fix:** validate `body.tables` with `z.array(z.enum(BACKUP_TABLES))` in the route *and* make `lib/backup.ts` refuse any table outside the allowlist before it reaches a query. Never build a statement by interpolating an identifier — map a validated name to a hard-coded statement.

### INFRA-002 — CRITICAL — SQL injection — attacker-controlled column names in the restore `INSERT`

- **File:** `lib/backup.ts:59-60, 67-72, 79-84`, reachable at `app/api/backup/import/route.ts:21-53`
- **Evidence**
  ```ts
  // lib/backup.ts:59-60
  `insert into public.${table} (${Object.keys(safe).map((k) => `"${k}"`).join(",")})
   values (${Object.keys(safe).map((_, i) => `$${i + 1}`).join(",")})
   on conflict do nothing`,
  ```
  The column names are the *keys of the request body*. `lib/system.ts:118` puts no constraint on them — `data: z.record(z.string(), z.array(z.record(z.any())))` — and `lib/system.ts:145` `sanitiseRow()` only strips a fixed `NEVER_BACKUP` list of key names; it never validates them. A key containing `"` terminates the quoted identifier early. The `on conflict (id) do update set "${k}" = $n` branch (`lib/backup.ts:71`, `:83`) repeats the same key at a second injection point.
- **Impact:** any authenticated user can execute attacker-chosen SQL against the live database by POSTing a crafted payload to `/api/backup/import` — a full read/write exfiltration primitive. The *table* is allowlisted and `user_id` is re-stamped (`lib/backup.ts:55`); the *columns* are not.
- **Fix:** resolve every row's keys against a per-table column allowlist derived from the schema and reject unknown keys before any SQL is built; at minimum enforce `/^[a-z_][a-z0-9_]*$/` on every key. Apply it to the skip, replace and merge branches.

### INFRA-003 — HIGH — the three admin secrets are compared with `===`, not in constant time

- **Files:** `app/api/migrations/run/route.ts:49`, `app/api/migrations/reset/route.ts:44`, `app/api/migrations/rollback/route.ts:35`, `app/api/cron/run/route.ts:29`, `app/api/backup/auto/route.ts:38`
- **Evidence**
  ```ts
  if (expected && got === expected) return null      // migrations/run:49
  if (got !== secret) { return errorResponse("Forbidden: missing or invalid CRON_SECRET", 403) }  // cron/run:29
  ```
  versus the correct pattern already in the repo — `app/api/mpesa/callback/route.ts:34`:
  ```ts
  if (!providedSecret || providedSecret.length !== callbackSecret.length ||
      !timingSafeEqual(Buffer.from(providedSecret), Buffer.from(callbackSecret))) { … }
  ```
- **Impact:** a timing side channel on the only barrier between the internet and the migration/cron/backup-admin endpoints. The correct pattern exists in the codebase but was not applied to these five sites, so the inconsistency is likely to be regressed.
- **Fix:** use `crypto.timingSafeEqual` with a byte-length pre-check at all five sites.

### INFRA-004 — HIGH — the M-Pesa C2B callbacks authenticate only by an IP allowlist that fails open

- **File:** `app/api/mpesa/c2b/confirmation/route.ts:19-26` (guard), `:185-193` (payment write); `lib/mpesa/daraja.ts:268-283`
- **Evidence**
  ```ts
  // app/api/mpesa/c2b/confirmation/route.ts:19, 24-26
   * Public endpoint, no auth (Daraja can't authenticate).
  if (!isFromSafaricom(request.headers.get("x-forwarded-for"))) {
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Forbidden" }, { status: 403 })
  }
  ```
  ```ts
  // lib/mpesa/daraja.ts:268-272
  const list = (process.env.MPESA_ALLOWED_CALLBACK_IPS || "").split(",").map((s) => s.trim()).filter(Boolean)
  if (list.length === 0) {
    return process.env.MPESA_ENV !== "production"      // ← every IP allowed
  }
  ```
  `MPESA_ENV` defaults to `"sandbox"` (`lib/mpesa/daraja.ts:47`). On success the handler writes a `rent_payments` row with `status: 'paid'` (`app/api/mpesa/c2b/confirmation/route.ts:185-193`).
- **Impact:** **unauthenticated payment mutation** — anyone can POST a forged Daraja confirmation and mark a rent payment paid without any money moving. Today the middleware masks this: `lib/supabase/middleware.ts:55-58` does not list `/api/mpesa/c2b/confirmation` in `isExternalApi`, so `middleware.ts:82-87` 401s the request — which also means **real Daraja callbacks cannot land today**. The obvious fix (adding the path to the allowlist) instantly exposes the fail-open guard.
- **Fix:** require a shared secret (reuse `MPESA_CALLBACK_SECRET` and the existing timing-safe compare) on the C2B endpoints; make the allowlist fail *closed* when unset in production; derive the client IP from the platform-controlled header (`x-vercel-forwarded-for`); add the C2B paths to the middleware allowlist in the same change.

### INFRA-005 — HIGH — the STK callback allowlist reads the client-controllable first `x-forwarded-for` hop

- **File:** `app/api/mpesa/callback/route.ts:38-41`
- **Evidence**
  ```ts
  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || null
  if (!isFromSafaricom(forwardedFor)) {
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Rejected" }, { status: 403 })
  }
  ```
  The XFF convention is client-first: the **first** entry is what the client sent, and intermediaries append. The route does also accept `MPESA_CALLBACK_SECRET` compared with `timingSafeEqual` (line 34) — the correct primary control — but the IP check is presented as a second factor.
- **Impact:** the documented `MPESA_ALLOWED_CALLBACK_IPS` control is bypassable with `X-Forwarded-For: <safaricom-ip>`. Any deployment relying on the IP list rather than the secret loses the control entirely.
- **Fix:** use `x-vercel-forwarded-for` (or the *last* XFF entry); keep `MPESA_CALLBACK_SECRET` mandatory and treat the IP list as defence-in-depth.

### INFRA-006 — HIGH — the callback marks the invoice paid without comparing the settled amount

- **File:** `app/api/mpesa/callback/route.ts:69-103`
- **Evidence** — the metadata carries `Amount` (documented at line 16) but the handler reads only the receipt number and the date:
  ```ts
  const update = {
    status,                                   // "completed" when ResultCode === 0
    result_code: resultCode,
    mpesa_receipt: meta.MpesaReceiptNumber || null,
    transaction_date: meta.TransactionDate ? String(meta.TransactionDate) : null,
    …
  }
  …
  if (status === "completed" && tx?.payment_id) {
    await supabase.from("rent_payments")
      .update({ status: "paid", paid_date: …, payment_method: "mpesa", reference_number: … })
      .eq("id", tx.payment_id).eq("user_id", tx.user_id)
  }
  ```
  `tx.amount` is selected on line 82 and then never used. Upstream, `app/api/mpesa/stkpush/route.ts:17-22` accepts any positive `amount` from the client and never compares it with the tenant's `monthly_rent` (selected on line 37).
- **Impact:** a KES 1 payment settles a KES 250,000 rent invoice. The rent ledger, arrears figures and landlord revenue reports are untrustworthy.
- **Fix:** derive the expected amount server-side from the rent invoice, reject a mismatched push, and in the callback compare `Number(meta.Amount)` with `tx.amount` (±1 KES) before flipping the row to `paid`; mark mismatches `unmatched` for review.

### INFRA-007 — HIGH — a paid subscription is granted for free when the Daraja environment is not production

- **Files:** `lib/mpesa/daraja.ts:47, 143-151, 203-212`; activation at `app/api/subscription/checkout-status/route.ts:32-79`
- **Evidence**
  ```ts
  // lib/mpesa/daraja.ts:47 — default is SANDBOX
  const env = (process.env.MPESA_ENV === "production" ? "production" : "sandbox") as DarajaEnv
  // lib/mpesa/daraja.ts:203-212 — mock mode always succeeds
  if (cfg.mock) { return { ResponseCode: "0", ResultCode: "0", … } }
  ```
  ```ts
  // app/api/subscription/checkout-status/route.ts:32-33, 55-79
  const completed = result.ResultCode === "0"
  …
  await adminClient.from("subscriptions").upsert({ user_id: userId, status: "active", current_period_end: periodEnd, … })
  ```
  The only guard on the push side is `if (!darajaConfigured() && process.env.MPESA_SANDBOX_MOCK !== "1")` (`app/api/subscription/checkout/route.ts:37`) — i.e. mock mode explicitly disables the guard.
- **Impact:** a production deployment that leaves `MPESA_ENV` at its default, or sets `MPESA_SANDBOX_MOCK=1` (a value present in local `.env` files and easy to copy into the dashboard), self-approves every payment. This is precisely the "invoice marked paid without money moving" case the owner asked about.
- **Fix:** refuse to run any payment path unless `MPESA_ENV === "production"` **and** `MPESA_SANDBOX_MOCK !== "1"`; make the mock path unreachable in production (fail closed at startup); never derive a paid entitlement from a status query the client can trigger.

### INFRA-008 — MEDIUM — two disagreeing sources of truth for "is this route public?"

- **File:** `lib/supabase/middleware.ts:53-58, 82-87`
- **Evidence**
  ```ts
  const isExternalApi =
    pathname === "/api/health" ||
    pathname === "/api/cron/run" ||
    pathname === "/api/mpesa/callback"
  …
  if (!user && isApi && !isExternalApi) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, … })
  }
  ```
  Meanwhile ~20 route files are written as public-by-design and contain **no** auth check of their own (`/api/contact:23`, `/api/newsletter:17`, `/api/pricing/lead:19`, `/api/enterprise/lead:21`, `/api/feedback:16`, `/api/customer-requests:37`, `/api/geocode:3`, `/api/blog`, `/api/docs`, `/api/features`, `/api/solutions`, `/api/roadmap`, `/api/plans`, `/api/brand`, `/api/templates`, `/api/backup/auto:126`, `/api/system/*`). The error runs both ways: `/api/mpesa/c2b/confirmation` is *documented* as public but is 401'd by the middleware.
- **Impact:** the effective auth posture of 89 routes is decided by a 3-line string list in a different file from the route logic. A new public route is one matcher change away from being exposed; a public route that looks protected in the middleware is in fact broken.
- **Fix:** have each route declare its own posture explicitly and enforce it in one place; delete the parallel allowlist. At minimum add a test that asserts the intended posture of every route.

### INFRA-009 — MEDIUM — system endpoints leak infrastructure metadata

- **File:** `app/api/system/ping/route.ts:12-45`; also `/api/system/version:11-23`, `/api/system/patches/check:13-40`, `/api/system/patches:11-13`, `/api/backup/auto:126-134`
- **Evidence**
  ```ts
  return NextResponse.json({
    ok: dbOk, db, latency_ms: Date.now() - started,
    schema_version: versionInfo, timestamp: new Date().toISOString(),
  }, { status: dbOk ? 200 : 503 })
  ```
  `/api/system/patches/check` returns the patches that have **not** been applied to production — a live map of the schema drift on the real database.
- **Impact:** reconnaissance — the database provider, the exact schema version, the Node runtime, the deployed git commit, the size of the user base, and which security patches are missing.
- **Fix:** keep only `{ ok: true }` on a genuinely public probe; move the detail behind `withAuth` or a dedicated ops secret.

### INFRA-030 — MEDIUM — one static bearer secret grants full schema/DDL control

- **File:** `app/api/migrations/run/route.ts:11-22, 29-58`; also `reset/route.ts:40-56`, `rollback/route.ts:29-45`
- **Evidence** — the design note states it plainly:
  > *"The secret header is a soft check; the real security is that this endpoint runs only on the host that owns the database. There is no admin user — anyone with the secret can apply patches."*

  The check is `if (expected && got === expected) return null` — one static string, reusable forever, no timestamp, no nonce, no request signature, no rotation mechanism anywhere in the repo. `applyPatch` then executes a file's contents with `sql.unsafe(sqlText)` (`run/route.ts:113-117`); `/api/migrations/rollback` does the same (`:80`).
- **Impact:** a leaked `MIGRATION_SECRET` (CI log, Vercel env dump, screenshot, shared secret store, former contractor) is an irrevocable, permanent grant of arbitrary SQL execution against production. It cannot be scoped, cannot be rotated without a coordinated deploy, and cannot be attributed. Any deployment that is not literally `NODE_ENV=production` silently accepts any signed-in subscriber as a migration admin.
- **Fix:** require a short-lived signed token (HMAC over method + path + timestamp + nonce) issued by a CLI; reject requests older than a few minutes; gate the dev fallback on an explicit `ALLOW_DEV_ADMIN=1` rather than `NODE_ENV !== "production"`.

### INFRA-029 — LOW — `POST /api/backup/auto` accepts an arbitrary `user_id` in the body

- **File:** `app/api/backup/auto/route.ts:44, 84-90`
- **Evidence:** `const body = (await request.json().catch(() => ({}))) as { user_id?: string; … }` … `const due = body.user_id ? candidates.filter((c) => c.userId === body.user_id) : …`; the fallback at lines 84-86 fabricates a candidate for `body.user_id` with no ownership check.
- **Impact:** admin-scoped by `BACKUP_CRON_SECRET`, so the blast radius is small, but the parameter gives the endpoint an unnecessary cross-tenant primitive.
- **Fix:** remove the parameter; drive selection from `user_profiles.auto_backup`.

### Full route inventory

| Route | Class | Methods |
|---|---|---|
| `/api/backup` | AUTH | GET, POST |
| `/api/backup/[id]` | AUTH | GET, DELETE |
| `/api/backup/auto` | ADMIN (secret) | GET, POST |
| `/api/backup/csv/[table]` | AUTH | GET |
| `/api/backup/import` | AUTH | POST |
| `/api/backup/list` | AUTH | GET |
| `/api/blog`, `/api/blog/[slug]` | PUBLIC | GET |
| `/api/brand` | PUBLIC | GET |
| `/api/company` | AUTH | GET, POST |
| `/api/contact` | PUBLIC | POST |
| `/api/cron/run` | ADMIN (secret) | POST |
| `/api/customer-requests` | PUBLIC | GET, POST |
| `/api/customers/[slug]` | PUBLIC | GET |
| `/api/damages` | AUTH | GET, POST |
| `/api/dashboard`, `/api/dashboard/activity`, `/api/dashboard/leases` | AUTH | GET |
| `/api/docs`, `/api/docs/[slug]` | PUBLIC | GET |
| `/api/documents` | AUTH | GET, POST |
| `/api/documents/[id]` | AUTH | GET, PUT, DELETE |
| `/api/documents/upload` | AUTH | POST |
| `/api/enterprise/lead` | PUBLIC | POST |
| `/api/expenses`, `/api/expenses/[id]`, `/api/expenses/recurring/run` | AUTH | GET/POST/PUT/DELETE |
| `/api/export` | AUTH | GET |
| `/api/features`, `/api/features/[slug]` | PUBLIC | GET |
| `/api/feedback` | PUBLIC | POST |
| `/api/geocode` | PUBLIC | GET |
| `/api/health` | PUBLIC | GET |
| `/api/maintenance`, `/api/maintenance/[id]` | AUTH | GET/POST/PUT/DELETE |
| `/api/migrations/reset`, `/api/migrations/rollback`, `/api/migrations/run` | ADMIN (secret) | POST |
| `/api/mpesa/c2b/confirmation` | PUBLIC (IP only) | POST |
| `/api/mpesa/c2b/register`, `/api/mpesa/c2b/status/[transId]` | AUTH | GET, POST |
| `/api/mpesa/c2b/validation` | PUBLIC (IP only) | POST |
| `/api/mpesa/callback` | ADMIN (secret + IP) | POST |
| `/api/mpesa/status`, `/api/mpesa/stkpush` | AUTH | GET, POST |
| `/api/newsletter` | PUBLIC | POST |
| `/api/notes`, `/api/notes/[id]` | AUTH | GET/POST/PUT/DELETE |
| `/api/notifications`, `/api/notifications/scan` | AUTH | GET/POST/PATCH/DELETE |
| `/api/paybill`, `/api/paybill/stream`, `/api/paybill/test-payment` | AUTH | GET, POST |
| `/api/payments`, `/api/payments/[id]` | AUTH | GET/POST/PUT/DELETE |
| `/api/plans` | PUBLIC | GET |
| `/api/pricing/lead` | PUBLIC | POST |
| `/api/profile` | AUTH | GET, PUT |
| `/api/properties`, `/api/properties/[id]` | AUTH | GET/POST/PUT/DELETE |
| `/api/properties/[id]/geocode`, `/api/properties/[id]/photos` | AUTH | GET/POST/PUT/PATCH/DELETE |
| `/api/quotations` | AUTH | GET, POST |
| `/api/reconciliation/bulk`, `/match`, `/resolve`, `/rules` | AUTH | GET, POST |
| `/api/reports` | AUTH | GET |
| `/api/roadmap`, `/api/solutions`, `/api/sub-processors` | PUBLIC | GET |
| `/api/stripe/webhook` | ADMIN (signature) | POST |
| `/api/subscription`, `/api/subscription/checkout`, `/api/subscription/checkout-status`, `/api/subscription/stripe-checkout` | AUTH | GET, POST, PATCH |
| `/api/support` | AUTH | GET, POST |
| `/api/system/health`, `/patches`, `/patches/check`, `/ping`, `/version` | PUBLIC | GET |
| `/api/templates`, `/api/templates/[id]`, `/[id]/docx`, `/[id]/preview` | PUBLIC | GET, POST |
| `/api/tenants`, `/api/tenants/[id]`, `/api/tenants/[id]/invite` | AUTH | GET/POST/PUT/DELETE |

---

## 2. SQL injection

The Neon `sql` tagged template parameterises `${ }` **values**, so the risk is interpolation that builds the SQL *string*. Two such places exist, both in `lib/backup.ts` and both reachable from a normal user account (INFRA-001, INFRA-002 above). Everything else was traced and is clean:

- `app/api/reconciliation/{bulk,match,resolve,rules}.ts` — all values are bound through the tagged template (`${userId}`, `${transaction.id}`, `${parsed.data.note ?? "…"}`); the `LIKE` pattern at `app/api/mpesa/c2b/validation/route.ts:78` is `like ${"%" + phone.slice(-9)}`, i.e. a *bound value*, not an identifier.
- `app/api/paybill/stream/route.ts:114-129` — the only dynamic fragment is a locally-built `where` string containing `$1`/`$2` placeholders; the values are bound through the parameter array. Safe.
- `app/api/migrations/{run,reset,rollback}.ts` — `sql.unsafe()` is used, but the SQL text comes from `supabase-setup/*.sql` files on disk or from `PATCH_LOG`; no user input reaches the statement.
- `lib/db/migrate.ts:75` — `(sql as any).query(stmt)` executes statements split out of local `.sql` files. The file's own comment is wrong ("the neon() template literal handles parameter interpolation") — `query()` does not parameterise — but the input is a file on disk, not user input.
- `db/migrations/*.sql` and `supabase-setup/*.sql` — the dynamic SQL uses PL/pgSQL `format('%s', …)`, which is a *value* placeholder, not `format('%I')` identifier interpolation. No injection.
- `lib/backup.ts:101` — `delete from public.${table} where …` has the same identifier-interpolation shape as line 31, but `deleteForUser` is currently unreachable (the restore options expose no wipe-first flag). It is a latent injection point and should be fixed with the same allowlist.

---

## 3. SSRF

**No SSRF surface was found.** Every server-side `fetch` in the repository targets a hard-coded host:

| Call site | Host | User input |
|---|---|---|
| `app/api/geocode/route.ts:8` | `nominatim.openstreetmap.org` | query string only, `encodeURIComponent`-encoded |
| `app/api/properties/[id]/geocode/route.ts:37-44` | `nominatim.openstreetmap.org` | server-built from the property's own address |
| `lib/mpesa/daraja.ts:78, 172, 218, 368, 496` | `api.safaricom.co.ke` / `sandbox.safaricom.co.ke` | none |
| `app/api/brand`, `/api/blog`, `/api/docs`, `/api/roadmap`, `/api/customer-requests` | static content in `lib/content/*` | none |
| `app/rss.xml/route.ts` | static content | none |

No route accepts a `url` / `imageUrl` / `src` parameter to fetch; there is no image proxy. The blog, feed, changelog, roadmap and news surfaces are static TypeScript modules.

### INFRA-031 — MEDIUM — …but `/api/geocode` is an unthrottled open relay to a third party

- **File:** `app/api/geocode/route.ts:3-17`
- **Evidence**
  ```ts
  const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ke&q=${encodeURIComponent(search)}`, {
    headers: { "User-Agent": "PropDeskAfrica/1.0 (property map)" },
    next: { revalidate: 3600 },
  })
  ```
- **Impact:** not SSRF — but the OpenStreetMap Foundation's usage policy requires ≤1 req/s and a meaningful User-Agent. An unthrottled relay gets the app's egress IP (possibly the Vercel shared range) blocked, breaking geocoding for every tenant, and it is a free bandwidth/latency amplifier aimed at a third party. The `revalidate: 3600` cache means a burst can poison the cache for an hour.
- **Fix:** add a per-user and per-IP rate limit and a server-side cache; require authentication; set a compliant User-Agent with a contact address (`NOMINATIM_EMAIL` is already read at `app/api/properties/[id]/geocode/route.ts:41` but is not applied to the public route).

---

## 4. File upload

### INFRA-013 — HIGH — documents and property photos live in a **public** Supabase Storage bucket

- **File:** `supabase-setup/01-create-tables.sql:326-328` (bucket), `336-355` (policies + comment); `app/api/documents/upload/route.ts:48`; `app/api/properties/[id]/photos/route.ts:70`
- **Evidence**
  ```sql
  -- supabase-setup/01-create-tables.sql:326-328
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('documents', 'documents', true)
  ```
  ```sql
  -- supabase-setup/01-create-tables.sql:353-355
  -- The bucket is public-readable so the app can render the URL directly
  -- without a signed-URL round-trip. Files are still scoped per-user via
  -- the path prefix (userId/...) enforced by the policies above.
  ```
  That last sentence is the flaw: for a **public** bucket the `storage.objects` SELECT policies (lines 340-343) do not protect the public object endpoint — any holder of the URL gets the bytes. The upload routes then hand the client a permanent public URL:
  ```ts
  // app/api/documents/upload/route.ts:48
  const { data: pub } = supabase.storage.from("documents").getPublicUrl(path)
  ```
- **Impact:** every lease agreement, contract, ID scan, invoice and property photo is permanently world-readable at a stable URL, with no expiry, no revocation and no access log. The object path is `{userId}/{Date.now()}-{filename}` — the user UUID is the only barrier, and user IDs are returned by numerous APIs and appear in URLs, emails and logs. One leaked link (referrer, proxy log, chat message, support screenshot) is permanent unauthenticated access to a landlord's confidential documents. Property photos share the same bucket and the same public path.
- **Fix:** make the bucket private; persist `storage_path` instead of `file_url`; serve objects through short-lived signed URLs — the codebase already has the pattern at `lib/storage.ts:59-68` (`getBackupSignedUrl`, 600 s). Serve downloads with `Content-Disposition: attachment` and `nosniff`; migrate existing objects.

### INFRA-014 — MEDIUM — `/api/documents/upload` validates neither content type nor magic bytes

- **File:** `app/api/documents/upload/route.ts:19-38, 43-55`
- **Evidence**
  ```ts
  if (!(file instanceof File)) { throw new HttpError("file is required", 400) }
  if (file.size > 10 * 1024 * 1024) { throw new HttpError("File too large (max 10 MB)", 413) }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")     // filename sanitised — good
  const path = `${userId}/${Date.now()}-${safeName}`
  await supabase.storage.from("documents").upload(path, file, {
    cacheControl: "3600", upsert: false,
    contentType: file.type || "application/octet-stream",          // ← client-declared
  })
  ```
  The size cap is present and the filename is sanitised (so **path traversal is not possible** — `[^a-zA-Z0-9._-]` replaces `/`). What is missing is any type check: `file.type` is the content type the client sent in the multipart part, and the bytes are never sniffed. The error message on line 43 even instructs the operator to make the bucket public.
- **Impact:** arbitrary content — HTML, script-bearing SVG, a polyglot — can be uploaded into a publicly readable bucket and served with the attacker's chosen content type. The app's `X-Content-Type-Options: nosniff` applies to the app's origin, not the Supabase storage origin, so the browser may render the file as HTML from the storage host: stored XSS on the storage domain and a ready-made malware/phishing host.
- **Fix:** allowlist extensions and content types, verify magic bytes, derive the stored content type from the sniffed type, and serve downloads with `Content-Disposition: attachment` + `nosniff`.

### INFRA-015 — MEDIUM — the photo upload trusts the client-declared MIME type and writes with the service-role key

- **File:** `app/api/properties/[id]/photos/route.ts:36, 53-70`
- **Evidence**
  ```ts
  if (!ALLOWED.has(file.type)) throw new HttpError("Image must be PNG/JPEG/WEBP/GIF", 415)   // client-declared
  …
  const storageClient = serviceKey && url
    ? createServiceClient(url, serviceKey, { auth: { persistSession: false } })
    : supabase                                                                              // service role ⇒ RLS bypassed
  await storageClient.storage.from("documents")
    .upload(path, buffer, { contentType: file.type, upsert: true, cacheControl: "3600" })
  ```
- **Impact:** (1) any non-image bytes are accepted as long as the client says `image/png`, and the file is then served from the public bucket with a client-controlled content type; (2) because the write uses the service role, the per-user `storage.objects` INSERT policy (`supabase-setup/01-create-tables.sql:336-339`) is never exercised — the storage layer is not a control on this path, which is exactly the control the schema claims to provide.
- **Fix:** sniff magic bytes (PNG `89 50 4E 47`, JPEG `FF D8 FF`, GIF `47 49 46`, WEBP `RIFF….WEBP`) and re-encode with `sharp`; upload with the caller's own scoped client so the policy applies; keep the bucket private.

---

## 5. Webhook verification

| Callback | Signature / secret | Raw body | Amount validated | Verdict |
|---|---|---|---|---|
| `app/api/stripe/webhook/route.ts` | `stripe-signature` vs `STRIPE_WEBHOOK_SECRET` | **yes** — `await req.text()` | n/a | **correct** |
| `app/api/mpesa/callback/route.ts` (STK) | `x-mpesa-callback-secret`, `timingSafeEqual` | n/a | **no** | INFRA-005, INFRA-006 |
| `app/api/mpesa/c2b/confirmation/route.ts` | IP allowlist only | n/a | **no** | INFRA-004 |
| `app/api/mpesa/c2b/validation/route.ts` | IP allowlist only | n/a | no | INFRA-004 |

**Verified good — the Stripe webhook.** `app/api/stripe/webhook/route.ts:6-16`:
```ts
const signature = req.headers.get("stripe-signature")
const secret = process.env.STRIPE_WEBHOOK_SECRET
if (!signature || !secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 400 })
const payload = await req.text()
event = getStripe().webhooks.constructEvent(payload, signature, secret)
```
It reads the **raw body** (`req.text()`, not `req.json()`), verifies the signature against it, rejects on failure, and records the event id for idempotency (`billing_webhook_events`, unique-constraint handled at line 23). Writes are scoped with `.eq("user_id", userId)` where `user_id` comes from the signed event metadata. This is the right shape and is not a finding.

**The M-Pesa side is where the money is mishandled.** `MPESA_CALLBACK_SECRET` is the one comparison in the codebase that *is* constant-time (`app/api/mpesa/callback/route.ts:34`), and the handler does require it — but the amount is never checked (INFRA-006), the IP allowlist reads a spoofable header (INFRA-005), and the C2B path has no secret at all (INFRA-004). INFRA-007 completes the picture: with `MPESA_ENV` left at its default the subscription flow approves itself.

**Can a callback mark an invoice paid without real money having moved?** Yes, in three independent ways:
1. `MPESA_ENV` unset/sandbox or `MPESA_SANDBOX_MOCK=1` → the status query returns a hard-coded success and the subscription is activated (INFRA-007).
2. The C2B confirmation path accepts a forged payload from any IP when the allowlist is unset and `MPESA_ENV !== "production"` (INFRA-004).
3. Even a genuine callback settles an underpayment, because the amount is never compared (INFRA-006).

---

## 6. Headers and browser security

`next.config.mjs:28-39` is the only header configuration in the project:

```js
async headers() {
  return [{
    source: "/(.*)",
    headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Strict-Transport-Security", value: "max-age=63072000" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
    ],
  }]
}
```

| Header | Status |
|---|---|
| `X-Content-Type-Options: nosniff` | ✅ present (app origin only — not the storage origin) |
| `Referrer-Policy: strict-origin-when-cross-origin` | ✅ present, good value — **no finding** |
| `X-Frame-Options: SAMEORIGIN` | ⚠️ present, but the modern control `frame-ancestors` is missing |
| `Strict-Transport-Security` | ⚠️ `max-age=63072000` only — no `includeSubDomains`, no `preload` |
| `Permissions-Policy` | ⚠️ incomplete — no `payment`, `usb`, `accelerometer`, `gyroscope`, `interest-cohort` |
| `Content-Security-Policy` | ❌ **absent entirely** (INFRA-010) |
| `Cross-Origin-Opener-Policy` | ❌ absent (INFRA-011) |
| `Cross-Origin-Resource-Policy` | ❌ absent (INFRA-011) |
| `X-XSS-Protection` | ❌ absent — no explicit `0` to retire the legacy filter (INFRA-011) |
| `Cross-Origin-Embedder-Policy` | ❌ absent (INFRA-011) |

### INFRA-010 — MEDIUM — no Content-Security-Policy

- **File:** `next.config.mjs:28-39` (no CSP, no `Content-Security-Policy-Report-Only`)
- **Impact:** no allow-list in front of script execution, no `object-src 'none'`, no `base-uri`, no `frame-ancestors`, and no reporting channel. A single injection anywhere in the app executes with the page's full privileges — and because marketing and dashboard share one origin, that includes the dashboard session.
- **Fix:** ship report-only first with a per-request nonce, collect violations, then enforce:
  `default-src 'self'; script-src 'self' 'nonce-<per-request>'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; img-src 'self' data: https://*.supabase.co; connect-src 'self' https://*.supabase.co`.

### INFRA-011 — MEDIUM — missing cross-origin / HSTS / Permissions-Policy hardening

- **File:** `next.config.mjs:28-39`
- **Impact:** `X-Frame-Options` alone is the legacy clickjacking control; `frame-ancestors` is the modern equivalent and is missing. HSTS without `includeSubDomains` leaves staging/preview/`*.vercel.app` willing to serve plaintext on a first visit, so a subdomain takeover can be used to strip the flag. COOP/CORP absent means the app can be framed and its responses embedded cross-origin.
- **Fix:** add `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin` (or `cross-origin` for the storage host), `X-XSS-Protection: 0`, `frame-ancestors 'none'` via CSP, extend HSTS to `max-age=63072000; includeSubDomains; preload`, and complete the Permissions-Policy list.

### INFRA-027 — LOW — two `dangerouslySetInnerHTML` sinks — safe today, unguarded

- **File:** `app/layout.tsx:89-103` (also `components/ui/chart.tsx:83-95`)
- **Evidence:** a repository-wide grep returns exactly two hits. `app/layout.tsx:91` injects `JSON.stringify({ "@context": "https://schema.org", … })` into `<script type="application/ld+json">` — a static object literal, safe. `components/ui/chart.tsx:83` injects a `<style>` block built from `THEMES` and the chart `config` — also developer-supplied, safe today.
- **Impact:** no live XSS. The risk is that both are unguarded sinks with no CSP in front of them and no `</script>` escaping: if either value ever becomes user- or database-derived, `JSON.stringify` does not escape `</script>` and the payload breaks out of the tag — a direct stored-XSS path to the dashboard.
- **Fix:** escape `</` as `<\/` inside JSON embedded in a `<script>` tag; add a lint rule banning new `dangerouslySetInnerHTML` uses; ship the CSP from INFRA-010.

---

## 7. Rate limiting and abuse

**There is no rate limiting anywhere in the application.** A repository-wide search for a rate limiter returns only marketing copy (`lib/content/marketing.ts:551`, describing a partner-API limit) and one changelog entry.

### INFRA-012 — MEDIUM — no rate limiting on any endpoint

- **Files:** `lib/actions.ts:11-50` (sign-in), `:56-107` (sign-up), `app/(marketing)/auth/forgot-password/action.ts:5-15` (reset); `app/api/contact/route.ts:23`, `app/api/newsletter/route.ts:17`, `app/api/pricing/lead/route.ts:19`, `app/api/enterprise/lead/route.ts:21`, `app/api/feedback/route.ts:16`, `app/api/customer-requests/route.ts:37`; `app/api/mpesa/stkpush/route.ts:12`; `app/api/subscription/checkout/route.ts:16`; `app/api/templates/[id]/docx/route.ts:12`; `app/api/geocode/route.ts:3`
- **Evidence**
  ```ts
  // lib/actions.ts:26-29 — no throttle of any kind
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.toString(), password: password.toString(),
  })
  ```
  ```ts
  // app/(marketing)/auth/forgot-password/action.ts:12
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${siteUrl}/auth/reset-password` })
  ```
  The only throttle that exists is Supabase's own email rate limit, which `lib/actions.ts:86` merely surfaces as an error message. The changelog entry at `lib/content/site.ts:69-72` claims *"Added per-IP rate limiting on /auth/login and a tamper-evident audit log for sensitive actions"* — **neither exists in this code**, and it is published on the marketing site.
- **Impact:** credential stuffing and password-reset email bombing; unlimited spam into the lead/contact/newsletter inboxes (each submission is also `console.info`'d server-side — a log-volume DoS); a flood of Daraja STK pushes that burns the merchant's Safaricom quota and generates real payment prompts to arbitrary MSISDNs; unbounded CPU-bound `.docx` generation; an unthrottled third-party relay (INFRA-031).
- **Fix:** add a shared limiter (Vercel KV / Upstash) keyed by IP + user + route; apply it to the auth actions, every public form, STK push + checkout, docx rendering and the geocode relay; return `429` with `Retry-After`. Correct the false changelog claim.

---

## 8. Session and cookie posture

### INFRA-026 — MEDIUM — no session revocation, no token-lifetime policy, cookie flags delegated to library defaults

- **File:** `lib/supabase/middleware.ts:30-49`; `lib/actions.ts:109-116`
- **Evidence**
  ```ts
  // lib/supabase/middleware.ts:35-41
  setAll(cookiesToSet) {
    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
    response = NextResponse.next({ request })
    cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
  }
  ```
  The `options` — `httpOnly`, `secure`, `sameSite`, `maxAge` — come entirely from `@supabase/ssr` defaults; the application never sets or asserts them and no test pins them. `signOut()` revokes the current session only; there is no "sign out everywhere" or revoke-all path anywhere. No access- or refresh-token lifetime is configured or asserted (Supabase defaults: 1 h access, 7 d refresh). The marketing cookie policy at `app/(marketing)/legal/cookies/page.tsx:35` asserts `sb-*` cookies are "httponly, secure" — a claim the code does not enforce or test.
- **Impact:** a stolen refresh token stays usable for up to a week and the owner cannot invalidate it — no revocation list, no "log out all devices", no admin-side session listing. The posture of the single cookie that grants full access to the landlord's data is decided by a library default nobody here verifies, so a Supabase project-level setting change silently weakens it.
- **Fix:** set and pin the cookie options explicitly (`httpOnly: true, secure: true, sameSite: "lax", path: "/"`); add a "sign out of all devices" action that revokes all refresh tokens; shorten the refresh-token lifetime in the Supabase project; assert the flags in a test.

**Session fixation:** not present — the session cookie is replaced on every request by the middleware, and `exchangeCodeForSession` (`app/(marketing)/auth/callback/route.ts:24`) issues a fresh session. The `next` redirect parameter is sanitised in both places (`lib/supabase/middleware.ts:131-136` and `app/(marketing)/auth/callback/route.ts:4-8`) — no open redirect.

### INFRA-019 — MEDIUM — password-reset redirects are built from a dev-named env var

- **File:** `app/(marketing)/auth/forgot-password/action.ts:10-14` (also `lib/actions.ts:74`)
- **Evidence**
  ```ts
  const siteUrl = process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${siteUrl}/auth/reset-password` })
  ```
- **Impact:** if `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` is left pointing at a dev/localhost origin in production, every reset email sends the recipient a link to the wrong host and the single-use recovery token is delivered to that origin. If neither variable is set the link points at `http://localhost:3000`. If `VERCEL_URL` resolves to a preview deployment, the token goes to that deployment.
- **Fix:** derive the redirect origin from a single validated `NEXT_PUBLIC_SITE_URL` that must be an absolute `https://` production URL; refuse to send a reset email otherwise; register the exact redirect URI in the Supabase allow-list.

---

## 9. Config and supply chain

### INFRA-020 — MEDIUM — `typescript.ignoreBuildErrors: true`, 54 type errors, and no CI

- **File:** `next.config.mjs:3-7`
- **Evidence**
  ```js
  // Strict TS, but don't fail builds on unrelated errors. Real errors are
  // caught by tsc in CI.
  typescript: { ignoreBuildErrors: true },
  ```
  There is no CI: no `.github/` directory, no workflow YAML anywhere (`find` over the repo). The captured baseline at `audit/baseline/tsc-baseline.log` shows **54** pre-existing `tsc --noEmit` errors, concentrated in `app/api/templates/[id]/preview/route.ts` (16), `app/dashboard/damages/page.tsx` (10) and `app/api/stripe/webhook/route.ts` (6).
- **Impact:** type errors ship silently. The type system is exactly what would catch an auth or tenancy mistake, and the stated safety net does not exist — the comment documents a control that was never built.
- **Fix:** clear the 54 errors, drop `ignoreBuildErrors`, and add a CI job running `tsc --noEmit` + `npm test` + `npm audit`.

### INFRA-021 — HIGH — `next@16.3.8` is inside the affected range of two critical RCE advisories

- **File:** `package.json:77` (`"next": "^16.3.8"`, installed 16.3.8)
- **Evidence** — `npm audit`:
  | Advisory | Severity | Range |
  |---|---|---|
  | [GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw) — RCE in the Image Optimization API with SVG | critical | `>=16.0.0 <=16.4.0` |
  | [GHSA-673q-mjm6-r5xr](https://github.com/advisories/GHSA-673q-mjm6-r5xr) — RCE in `use cache` functions returning typed arrays | critical | `>=16.0.0 <=16.4.0` |
  | [GHSA-p3m5-59mp-jv5r](https://github.com/advisories/GHSA-p3m5-59mp-jv5r) — DoS in App Router using Server Actions | high | `>=16.0.0 <=16.4.0` |

  `fixAvailable: true`.
- **Impact:** two of the three paths are *accidentally* closed in this deployment — `images: { unoptimized: true }` (`next.config.mjs:11-13`) disables the `/_next/image` optimizer the SVG RCE needs, and a repository-wide search finds no `use cache` directive, so the typed-array RCE has no reachable sink. The Server Actions DoS is live: the app ships Server Actions at `lib/actions.ts:1` and `app/(marketing)/auth/forgot-password/action.ts:1`, and an unauthenticated attacker can hammer them. The critical advisories sit in the framework the whole app is built on, so the mitigation cannot be relied on indefinitely.
- **Fix:** upgrade `next` to a patched release (`npm audit fix`, or pin above the affected range) and re-run `npm run build`; re-test the SVG path once the optimizer is re-enabled.

### INFRA-022 — MEDIUM — `zod@3.25.76` — GHSA-mrhx-c7xc-m3w5 (memory exhaustion)

- **File:** `package.json:92` (`"zod": "3.25.76"`)
- **Evidence:** `npm audit` reports `zod` **high**, affected `<4.6.6`, fix `zod@4.6.7` (semver-major) — *"Zod can exhaust memory while validating oversized constrained collections"*. The app validates untrusted bodies with zod on every public endpoint, including constrained collections such as `z.array(z.string().trim().min(1).max(80)).min(1).max(100)` at `app/api/reconciliation/bulk/route.ts:7`.
- **Impact:** a crafted payload can make the validating function allocate far more memory than the schema implies — on a Vercel serverless function that is an out-of-memory kill and a bill: a cheap DoS on a metered runtime.
- **Fix:** upgrade to `zod@^4.6.7` and re-run the validation tests; until then add an explicit byte-size guard on `await request.json()` at the public endpoints and cap array lengths before parsing.

### INFRA-023 — MEDIUM — no `vercel.json`

- **File:** `next.config.mjs:1-45` (no `vercel.json` in the repository root; `ls vercel.json` → *No such file or directory*, and a repo-wide search finds none)
- **Evidence:** deployment configuration is entirely implicit — no `crons[]`, no `redirects()` for `http://` → `https://`, no `headers` override, and no `maxDuration` on the long-running backup routes (`app/api/backup/route.ts:18`, `app/api/backup/auto/route.ts:5`, `app/api/backup/csv/[table]/route.ts:6` all set `export const runtime = "nodejs"` but no duration).
- **Impact:** (1) the lease-expiry, recurring-expense, document-expiry and maintenance-reminder scans **never run** — nothing in the repo schedules `POST /api/cron/run` and no external scheduler is configured, so those features are silently dead while `app/api/cron/run/route.ts:9-19` claims to be the cron replacement; (2) the backup routes serialise a whole tenant to JSON in one invocation with no duration cap and will time out on a large tenant.
- **Fix:** add `vercel.json` with a `crons[]` entry for `/api/cron/run` (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`, which the route already accepts), a `maxDuration` for the backup routes, an explicit `http://` → `https://` redirect, and a `headers` block carrying the CSP and cross-origin headers from INFRA-010/011.

### INFRA-028 — LOW — `images.unoptimized: true`

- **File:** `next.config.mjs:8-13`
- **Evidence**
  ```js
  // Use Next's own image pipeline. (unoptimized: true disables the proxy
  // and lets images be served straight from the host — ...)
  images: { unoptimized: true },
  ```
  The comment describes the opposite of what the flag does.
- **Impact:** every `<Image>` renders as a raw `<img src=…>` — no format negotiation, no responsive `srcset`, no resizing, no protection against a decompression bomb or an 8 MB user upload served at full resolution. It also means the `next/image` optimizer — the sink for GHSA-2464-fhr4-w9xw — is off, which is currently the only thing keeping that critical advisory from being reachable.
- **Fix:** turn it back off once `next` is upgraded past the affected range, or enforce explicit dimensions and a server-side re-encode at upload; fix the comment either way.

### INFRA-024 — MEDIUM — the backup response carries the whole tenant dataset with no size cap and no `Cache-Control: no-store`

- **File:** `app/api/backup/route.ts:25-93`
- **Evidence**
  ```ts
  const payload = await exportBackup(userId, email, { tables: body?.tables })
  …
  return NextResponse.json({ ok: true, id, filename: backupFilename(), size_bytes: sizeBytes, …, payload: inlinePayload })
  ```
  No `cache-control` header is set — contrast `app/api/export/route.ts:81`, which does set `cache-control: no-store` on the equivalent payload.
- **Impact:** a large tenant can exceed the function's memory or duration limit and take the request down; and because the response omits `Cache-Control: no-store`, an intermediary CDN or proxy may cache a response containing every property, tenant, payment, expense, document and reconciliation row the landlord has.
- **Fix:** return a manifest (id, label, counts, sizes) and serve the payload from private storage via a short-lived signed URL; add `cache-control: no-store, private` to every response carrying tenant data; cap the export size.

---

## 10. Design flaws

### INFRA-018 — MEDIUM — two data stores, two security models, chosen at runtime

- **File:** `lib/db/neon.ts:23-27, 36-42`; `lib/backup.ts:168-170`; `lib/supabase/server.ts:25-54`; `lib/api/with-db-auth.ts:14-16`
- **Evidence**
  ```ts
  // lib/db/neon.ts:26
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || null
  ```
  ```ts
  // lib/api/with-db-auth.ts:14-16
  * The handler must explicitly scope every query by `userId` — there's no
  * RLS on Neon, so the application code carries that responsibility.
  ```
  `getDbLayer()` (`lib/backup.ts:168-170`) then picks `neonDb` (raw SQL, no RLS) or `supabaseDb` (PostgREST, RLS enforced) for the same operation.
- **Impact:** the same feature has two different guarantees depending on an environment variable. The Neon path has no RLS behind it, and the Neon connection role is normally the table owner, so enabling RLS later would not apply either — there is no `FORCE ROW LEVEL SECURITY` anywhere in the repo (verified by grep). A forgotten `user_id` filter is a cross-tenant leak on the Neon path and is silently blocked on the Supabase path, so the bug only reproduces in production.
- **Fix:** pick one primary store and fail fast if it is not configured; enable `FORCE ROW LEVEL SECURITY` on Neon with per-user policies as the safety net; put the fallback behind an explicit, loudly-logged flag.

### INFRA-016 — HIGH — `anon`-callable `SECURITY DEFINER` RPCs allow cross-tenant tampering and deletion

- **File:** `supabase-setup/13-paybill-counters.sql:8-20` (also `supabase-setup/12-auto-backup.sql:11-32`)
- **Evidence**
  ```sql
  -- supabase-setup/13-paybill-counters.sql:8-20
  create or replace function public.bump_paybill_counters(p_paybill_id uuid, p_matched boolean)
  returns void language sql security definer as $$
    update public.paybills
    set matched_count = matched_count + case when p_matched then 1 else 0 end, …
    where id = p_paybill_id;
  $$;
  grant execute on function public.bump_paybill_counters(uuid, boolean) to service_role, anon, authenticated;
  ```
  ```sql
  -- supabase-setup/12-auto-backup.sql:11-32
  create or replace function public.prune_old_backups() returns integer language plpgsql security definer as $$
    … delete from public.backups b using ranked r where b.id = r.id and r.rn > 50; …
  $$;
  grant execute on function public.prune_old_backups() to service_role, authenticated;
  ```
  Neither pins `search_path`.
- **Impact:** any anonymous internet caller can `POST https://<project>.supabase.co/rest/v1/rpc/bump_paybill_counters` with an arbitrary paybill UUID and inflate `matched_count` / `unmatched_count` and set `last_payment_at` on a landlord's paybill — the counters the dashboard presents as *payments received*. Any registered user can call `prune_old_backups()` and destroy other tenants' backup history. Both are also exposed to search_path hijacking.
- **Fix:** `revoke execute … from anon, authenticated;` and grant only to `service_role`; add `set search_path = public, pg_temp;`; call them from the internal routes with the service-role client instead of exposing them as RPCs.

### INFRA-017 — MEDIUM — the Supabase fallback instructs the operator to create an arbitrary-SQL RPC

- **File:** `app/api/migrations/run/route.ts:119-123` (also `app/api/migrations/rollback/route.ts:82-86`)
- **Evidence**
  ```ts
  const { error } = await supa.rpc("exec_sql", { sql: sqlText })
  if (error) throw new Error(`Supabase exec_sql RPC missing — add a SECURITY DEFINER function. Underlying: ${error.message}`)
  ```
- **Impact:** in Postgres, `CREATE FUNCTION` grants EXECUTE to `PUBLIC` by default, and Supabase exposes every RPC to the `anon`/`authenticated` roles over PostgREST. A `SECURITY DEFINER exec_sql(sql text)` created as instructed and not explicitly revoked is callable by **any unauthenticated internet user** via `POST /rest/v1/rpc/exec_sql` with an arbitrary `sql` body — total database compromise. The error message is an instruction to build that backdoor.
- **Fix:** never ship a raw-SQL RPC; run migrations out-of-band with the service-role key and delete the `exec_sql` call and the guidance from the error message; if a SQL-execution RPC is unavoidable, revoke it from `anon`/`authenticated`, keep it `service_role`-only and restrict it to an allowlist of statements.

### INFRA-025 — MEDIUM — team roles are stored but never enforced

- **File:** `app/api/company/route.ts:14, 37-58`
- **Evidence**
  ```ts
  role: z.enum(["admin", "manager", "agent", "accountant", "viewer"]).default("agent")
  …
  await supabase.from("team_members")
    .upsert({ company_id: company.id, name: parsed.data.name, email: parsed.data.email, role: parsed.data.role }, { onConflict: "company_id,email" })
  ```
  A repository-wide search for role checks in the authorisation path finds none: `lib/api/index.ts` (`withAuth`) establishes only *a valid session* and *the caller owns this row*.
- **Impact:** the role is decorative. A teammate added as `viewer` has exactly the same API access as the workspace owner — they can create a backup, invite further members, connect a paybill and issue an M-Pesa push. A landlord who believes they have limited a contractor's access has granted full access to every property, tenant, payment and document. A role called `admin` grants no additional privilege either, so privileged access can neither be granted nor revoked.
- **Fix:** resolve the caller's membership and role for the company that owns the row and check it in `withAuth` before any write; until that exists, remove the role field from the UI so it does not promise isolation that is not enforced.

### INFRA-008 / INFRA-009 / INFRA-024 / INFRA-030 — see §1 and §9

### Marketing and dashboard share one app, one origin and one matcher

- **File:** `middleware.ts:13-22`; `lib/supabase/middleware.ts:82-87`
- **Evidence**
  ```js
  export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)"],
  }
  ```
- **Impact:** the dashboard session cookie is sent to the same origin as the marketing site, so any injection on a marketing page (blog, roadmap, docs) or any compromised third-party script inherits the dashboard's origin and can issue authenticated requests against the dashboard API. The same single matcher is also what decides which API routes are public (INFRA-008), so one matcher governs both the page surface and the API surface.
- **Fix:** serve marketing from a separate origin/app so a marketing-page XSS cannot reach the dashboard origin, and enforce a strict CSP (INFRA-010) so an injected script is blocked even before the split.

---

## Severity roll-up

| Severity | IDs |
|---|---|
| **CRITICAL (2)** | INFRA-001, INFRA-002 |
| **HIGH (8)** | INFRA-003, INFRA-004, INFRA-005, INFRA-006, INFRA-007, INFRA-013, INFRA-016, INFRA-021 |
| **MEDIUM (18)** | INFRA-008, INFRA-009, INFRA-010, INFRA-011, INFRA-012, INFRA-014, INFRA-015, INFRA-017, INFRA-018, INFRA-019, INFRA-020, INFRA-022, INFRA-023, INFRA-024, INFRA-025, INFRA-026, INFRA-030, INFRA-031 |
| **LOW (3)** | INFRA-027, INFRA-028, INFRA-029 |

## Suggested remediation order

1. **INFRA-001, INFRA-002** — allowlist the table list and the column names. These are the launch blocker; both are reachable by any registered landlord today.
2. **INFRA-004, INFRA-005, INFRA-006, INFRA-007** — close the money paths: secret-gate the C2B callbacks, trust the platform IP header, compare the settled amount, and fail closed outside production.
3. **INFRA-013, INFRA-014, INFRA-015** — make the bucket private and start serving signed URLs.
4. **INFRA-016, INFRA-017** — revoke the `anon`/`authenticated` EXECUTE grants; remove the `exec_sql` guidance.
5. **INFRA-021, INFRA-022** — upgrade `next` and `zod`; then remove `ignoreBuildErrors` and add CI (INFRA-020).
6. **INFRA-010 → INFRA-011 → INFRA-012 → INFRA-008** — CSP (report-only first), the remaining headers, the rate limiter, then unify the auth model.
7. The MEDIUM/LOW design and config items.

---

## Remediation status (owner-side pass, after this track reported)

This file is the original finding write-up. The **current status of every
finding in this track** lives in `audit/findings/infra.json` — each entry carries a `status`
(`FIXED` / `PARTIAL` / `OPEN` / `DONE`) and a `fix_notes` field describing
what was actually changed.

Track summary as of the end of the hardening pass:

| Severity | Total | FIXED | PARTIAL | OPEN | DONE |
|---|---:|---:|---:|---:|---:|
| CRITICAL | HIGH | LOW | MEDIUM | 32 | 11 | 5 | 16 | 0 |


The headline for this track: the two CRITICAL SQL injections are closed, the public storage bucket is private, the Next.js RCE advisories are patched, the M-Pesa callbacks fail closed, and the migration runner no longer silently skips statements.

See `AUDIT_REPORT.md` for the consolidated verdict and `HARDENING_RUNBOOK.md`
for the go-live sequence.
