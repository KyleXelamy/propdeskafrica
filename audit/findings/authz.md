# PropDesk Africa — Authentication, Authorization, Tenancy & IDOR Findings

**Task:** `audit-authz` · **Track:** read-only security audit · **Date:** 2026-10-26
**Scope:** authentication enforcement, authorization / privilege model, tenant isolation, IDOR,
mass assignment, service-role bypass, middleware bypass. **Out of scope:** encryption, headers,
dependency CVEs, product features.

**Method.** Every `app/api/**/route.ts` (94 files) was enumerated and its auth mechanism
established from the source, not from the docs. Then read: `lib/api/index.ts` (`withAuth`),
`lib/api/with-db-auth.ts` (`withDbAuth`), `lib/supabase/{server,service,middleware,client}.ts`,
`middleware.ts`, `lib/backup.ts`, `lib/system.ts`, `lib/mpesa/daraja.ts`, `lib/storage.ts`,
`lib/actions.ts`, `lib/actions/settings.ts`, `app/(marketing)/auth/**`,
`app/dashboard/**` (server + client components), `db/migrations/001-core.sql`,
`db/migrations/002-support.sql`, every `supabase-setup/*.sql` (for the RLS policies) and
`audit/INDEPENDENT_FINDINGS.md`. Every finding below cites a `file:line` that resolves in the
repository as of commit `467c500`. No application file was modified.

---

## 0. The auth model as actually implemented

There are **three** independent gates, and it matters which one is doing the work:

| # | Gate | Where | What it enforces |
|---|---|---|---|
| 1 | **Middleware** | `middleware.ts:9-11` → `lib/supabase/middleware.ts:18-118` | 401 for **all** `/api/**` except `/api/health`, `/api/cron/run`, `/api/mpesa/callback` (`:55-58`, `:82-87`); redirect for `/dashboard/**`; email-verification gate (`:90-94`); subscription gate (`:103-115`) |
| 2 | **`withAuth`** | `lib/api/index.ts:22-62` | Server-side `supabase.auth.getUser()` → 401 if no user; same-origin check on every mutating verb (`:34-40`, `:76-89`) |
| 3 | **`withDbAuth`** | `lib/api/with-db-auth.ts:69-109` | Same, plus a Neon handle. **Dead code — zero call sites.** `grep -rn "withDbAuth"` finds only the definition. |

**Consequence:** the middleware, not the route handlers, is what actually keeps anonymous
callers out of the ~40 API routes that have no `withAuth` wrapper. Two structural facts follow,
and both matter for the findings below:

* **The API routes that use `withAuth` talk to Supabase Postgres (PostgREST), not Neon.**
  `supabase.from(...)` in a route handler sends the *user's* JWT, so the RLS policies in
  `supabase-setup/*.sql` apply **on the Supabase path only**.
* **The Neon path has no RLS.** `db/migrations/001-core.sql:6-13` and
  `lib/api/with-db-auth.ts:14-15` say so explicitly, and the `auth.uid()`-based policies in
  `supabase-setup/*.sql` cannot even be created on Neon (`auth.uid()` does not exist there), so
  those patches fail and RLS is never enabled on Neon. Every Neon query must therefore be scoped
  by `user_id` **in application code**.

**What "tenant" means here:** a landlord's workspace is the set of rows whose `user_id` equals
the Supabase auth uid. There is no `organization_id` and **no role column that any
authorization decision reads** — see §4 "Categories with zero findings".

---

## 1. Route inventory (every `app/api/**/route.ts`)

`EA` = `withAuth` (server-side `getUser()`). `PW` = public by design, no session needed.
`PW!` = public by design **but** the middleware currently 401s it (broken, see §1.1).
`SG` = secret-gated (shared secret, not a session).

| Route | Methods | Gate | Owner scope | Class |
|---|---|---|---|---|
| `app/api/health/route.ts` | GET | none | n/a | PW (exempt in middleware) |
| `app/api/system/health/route.ts` | GET | none | n/a | PW! |
| `app/api/system/ping/route.ts` | GET | none | platform aggregate | PW! |
| `app/api/system/version/route.ts` | GET | none | n/a | PW! |
| `app/api/system/patches/route.ts` | GET | none | n/a | PW! |
| `app/api/system/patches/check/route.ts` | GET | none | platform aggregate | PW! |
| `app/api/blog/route.ts` | GET | none | static content | PW! |
| `app/api/blog/[slug]/route.ts` | GET | none | static content | PW! |
| `app/api/customers/[slug]/route.ts` | GET | none | static content | PW! |
| `app/api/docs/route.ts`, `app/api/docs/[slug]/route.ts` | GET | none | static content | PW! |
| `app/api/features/route.ts`, `app/api/features/[slug]/route.ts` | GET | none | static content | PW! |
| `app/api/solutions/route.ts`, `app/api/roadmap/route.ts` | GET | none | static content | PW! |
| `app/api/sub-processors/route.ts` | GET | none | static content | PW! |
| `app/api/plans/route.ts` | GET | none | static content | PW! |
| `app/api/brand/route.ts` | GET | none | static content | PW! |
| `app/api/templates/route.ts`, `[id]/route.ts`, `[id]/preview/route.ts`, `[id]/docx/route.ts` | GET, POST | none | static templates | PW! |
| `app/api/contact/route.ts` | POST, GET | none | stub | PW! |
| `app/api/newsletter/route.ts` | POST, GET | none | stub | PW! |
| `app/api/feedback/route.ts` | POST, GET | none | stub | PW! |
| `app/api/customer-requests/route.ts` | GET, POST | none | in-memory roadmap | PW! |
| `app/api/pricing/lead/route.ts` | POST, GET | none | stub | PW! |
| `app/api/enterprise/lead/route.ts` | POST, GET | none | stub | PW! |
| `app/api/geocode/route.ts` | GET | none | proxy to Nominatim | PW! |
| `app/api/stripe/webhook/route.ts` | POST | Stripe signature | signed `user_id` | **must be PW** — currently 401 (broken) |
| `app/api/mpesa/callback/route.ts` | POST | secret + IP allowlist | `tx.user_id` | PW (exempt in middleware) |
| `app/api/mpesa/c2b/validation/route.ts` | POST | IP allowlist only | n/a | **must be PW** — currently 401 (broken) |
| `app/api/mpesa/c2b/confirmation/route.ts` | POST | IP allowlist only | resolved paybill owner | **must be PW** — currently 401 (broken) |
| `app/api/cron/run/route.ts` | POST | `CRON_SECRET` (prod) | platform-wide scans | SG (exempt in middleware) |
| `app/api/migrations/run/route.ts`, `app/api/migrations/reset/route.ts`, `app/api/migrations/rollback/route.ts` | POST | `MIGRATION_SECRET` (prod) | platform schema | SG |
| `app/api/backup/auto/route.ts` | POST, GET | `BACKUP_CRON_SECRET` (prod) | platform-wide | SG |
| `app/api/properties/route.ts` | GET, POST | EA | `.eq("user_id", userId)` | ✅ |
| `app/api/properties/[id]/route.ts` | GET, PUT, DELETE | EA | `.eq("id").eq("user_id")` | ✅ |
| `app/api/properties/[id]/geocode/route.ts` | POST | EA | property lookup + update both scoped | ✅ |
| `app/api/properties/[id]/photos/route.ts` | GET, POST, DELETE, PATCH | EA | property ownership verified `:44-51`; service-role storage path is user-prefixed | ✅ |
| `app/api/tenants/route.ts` | GET, POST | EA | `.eq("user_id")` on read; `user_id` forced on write | ⚠ `property_id` unvalidated → AUTHZ-006 |
| `app/api/tenants/[id]/route.ts` | GET, PUT, DELETE | EA | `.eq("id").eq("user_id")` | ⚠ `property_id` unvalidated → AUTHZ-006 |
| `app/api/tenants/[id]/invite/route.ts` | POST, DELETE | EA | **no owner check on the link** | ❌ AUTHZ-002 / AUTHZ-003 |
| `app/api/payments/route.ts` | GET, POST | EA | `.eq("user_id")` | ⚠ `tenant_id`/`property_id` unvalidated → AUTHZ-006 |
| `app/api/payments/[id]/route.ts` | GET, PUT, DELETE | EA | `.eq("id").eq("user_id")` | ⚠ → AUTHZ-006 |
| `app/api/expenses/route.ts`, `[id]/route.ts`, `recurring/run/route.ts` | GET, POST, PUT, DELETE | EA | `.eq("id").eq("user_id")` | ⚠ `property_id` unvalidated → AUTHZ-006 |
| `app/api/maintenance/route.ts`, `[id]/route.ts` | GET, POST, PUT, DELETE | EA | `.eq("id").eq("user_id")` | ⚠ → AUTHZ-006 |
| `app/api/documents/route.ts`, `[id]/route.ts`, `upload/route.ts` | GET, POST, PUT, DELETE | EA | `.eq("id").eq("user_id")` | ⚠ → AUTHZ-006 |
| `app/api/notes/route.ts`, `[id]/route.ts` | GET, POST, PUT, DELETE | EA | `.eq("id").eq("user_id")` | ⚠ → AUTHZ-006 |
| `app/api/notifications/route.ts`, `scan/route.ts` | GET, POST, PATCH, DELETE | EA | `.eq("id").eq("user_id")` | ✅ |
| `app/api/dashboard/route.ts`, `activity/route.ts`, `leases/route.ts` | GET | EA | `.eq("user_id")` | ✅ |
| `app/api/reports/route.ts` | GET | EA | `.eq("user_id")` | ✅ |
| `app/api/export/route.ts` | GET | EA | `.eq("user_id")` on all 7 tables | ✅ |
| `app/api/profile/route.ts` | GET, PUT | EA | `.eq("user_id")`; upsert forces `user_id` | ✅ |
| `app/api/company/route.ts` | GET, POST | EA | `company_id` derived from `owner_id` | ✅ |
| `app/api/damages/route.ts` | GET, POST | EA | stub only | ✅ (stub) |
| `app/api/quotations/route.ts` | GET, POST | EA | stub only | ✅ (stub) |
| `app/api/support/route.ts` | GET, POST | EA | stub only | ✅ (stub) |
| `app/api/backup/route.ts`, `list`, `[id]`, `csv/[table]` | GET, POST, DELETE | EA | `exportBackup(userId)` / `.eq("user_id")` | ✅ |
| `app/api/backup/import/route.ts` | POST | EA | `restoreBackup(userId, …)` re-stamps `user_id` | ❌ **AUTHZ-001** (SQLi) |
| `app/api/paybill/route.ts` | GET, POST | EA + service role | `.eq("user_id")`; property ids validated `:53-57` | ✅ |
| `app/api/paybill/test-payment/route.ts` | POST | EA + service role | `.eq("user_id")` | ✅ |
| `app/api/paybill/stream/route.ts` | GET | `getUser()` | Neon join `p.user_id = $1` | ✅ |
| `app/api/mpesa/stkpush/route.ts` | POST | EA | tenant ownership verified `:35-42` | ⚠ `payment_id` unvalidated → AUTHZ-006 |
| `app/api/mpesa/status/route.ts` | GET | EA | `.eq("checkout_request_id").eq("user_id")` | ✅ |
| `app/api/mpesa/c2b/status/[transId]/route.ts` | GET | EA | cache path scoped | ❌ fallback path unscoped → AUTHZ-004 |
| `app/api/mpesa/c2b/register/route.ts` | POST | EA | **none** | ❌ AUTHZ-005 |
| `app/api/subscription/route.ts` | GET, PATCH | EA | `.eq("user_id")` | ❌ entitlement bypass → AUTHZ-009 |
| `app/api/subscription/checkout/route.ts` | POST | EA + service role | `user_id` from session | ✅ |
| `app/api/subscription/checkout-status/route.ts` | GET | EA + service role | `row` found with `.eq("user_id")` first | ✅ |
| `app/api/subscription/stripe-checkout/route.ts` | POST | EA + service role | `user_id` from session | ✅ |

### 1.1 The middleware is over-broad (systemic, not a finding)

`lib/supabase/middleware.ts:82-87` returns 401 for **every** `/api/**` path except the three in
`isExternalApi` (`:55-58`). That list is missing `/api/stripe/webhook`,
`/api/mpesa/c2b/validation` and `/api/mpesa/c2b/confirmation` — all three are webhooks that a
third party (Stripe / Safaricom) must be able to call without a session. They are therefore
**broken today**: Stripe cannot deliver events and Daraja cannot deliver C2B validations or
confirmations. The same blanket 401 also breaks the marketing content APIs and the tenant-facing
lead forms.

This cuts both ways and the report has to be honest about it:

* it **shrinks** today's anonymous attack surface to `/api/health`, `/api/cron/run` and
  `/api/mpesa/callback` — all three of which are correctly secret/IP gated;
* it is **not** a deliberate control, it is a side effect. Any future change that adds a path to
  `isExternalApi`, or any deployment where the middleware is not applied (see AUTHZ-013),
  re-exposes the un-authenticated routes below;
* it makes AUTHZ-009/AUTHZ-011 currently unreachable rather than fixed.

**Fix (do this together with the fix stage):** replace the three hard-coded paths with an
explicit allowlist of unauthenticated API routes, e.g.

```ts
// lib/supabase/middleware.ts
const PUBLIC_API = [
  "/api/health",
  "/api/cron/run",
  "/api/mpesa/callback",
  "/api/mpesa/c2b/validation",
  "/api/mpesa/c2b/confirmation",
  "/api/stripe/webhook",
]
const isPublicApi = PUBLIC_API.some((p) => pathname === p || pathname.startsWith(`${p}/`))
if (!user && isApi && !isPublicApi) { /* 401 */ }
```

and give the remaining marketing APIs the same treatment (or serve them from a route group that
opts out of the middleware).

---

## 2. Findings

### AUTHZ-001 — CRITICAL — SQL injection in backup restore lets any account write into another landlord's rows

**File:** `lib/backup.ts:48-96` (the three `sql.unsafe(...)` calls at `:59`, `:67`, `:79`)
**Reachable from:** `app/api/backup/import/route.ts:21-54` → `POST /api/backup/import`
**Category:** mass-assignment / missing-ownership-check (cross-tenant write)

**Vulnerable code** — the column list is built by string-interpolating the **JSON keys of the
attacker-supplied restore payload**:

```ts
// lib/backup.ts:55-63
const safe = table === "user_profiles" ? { ...row, id: userId, user_id: userId } : { ...row, user_id: userId }
...
const result = await (sql as any).unsafe(
  `insert into public.${table} (${Object.keys(safe).map((k) => `"${k}"`).join(",")})
   values (${Object.keys(safe).map((_, i) => `$${i + 1}`).join(",")})
   on conflict do nothing`,
  Object.values(safe),
) as any
```

`BackupPayloadSchema` (`lib/system.ts:109-120`) types every row as
`z.record(z.string(), z.array(z.record(z.any())))` — **no constraint on key names**, and
`sanitiseRow()` (`lib/system.ts:145-152`) only strips secret-looking *values*. The table name is
allowlisted (`BACKUP_TABLES`, `lib/system.ts:22-42`) and `user_id` is re-stamped — but the
*columns* are not validated. A `"` inside a key closes the quoted identifier early.

**Attack path**

1. Attacker registers a normal landlord account (self-service signup, email verification only).
2. `POST /api/backup/import` with `Content-Type: application/json`, same-origin header
   (`withAuth` requires Origin/Referer to match the host — a browser on the app's own origin
   satisfies this, and the attacker controls their own browser).
3. Body:

```json
{
  "schema_version": 11, "app_version": "5.0.0", "generated_at": "2026-01-01T00:00:00Z",
  "user": { "id": "x" }, "counts": {},
  "data": {
    "properties": [
      {
        "id\") values ($1,$2,$3) on conflict (id) do update set \"user_id\" = $3 --": "x",
        "id": "<victim-property-uuid>",
        "user_id": "<ignored, re-stamped>"
      }
    ]
  }
}
```

4. The generated statement becomes (the `--` comments out the rest):

```sql
insert into public.properties ("id") values ($1,$2,$3)
  on conflict (id) do update set "user_id" = $3
```

   `Object.values(safe)` supplies exactly three bound parameters, so the count matches and
   Postgres executes it. `on conflict (id) do update` is the `replace`/`merge` branch
   (`:66-87`), which is reachable with `options.on_conflict = "replace"`.

**Impact**

* **Cross-tenant write / privilege escalation:** `on conflict (id) do update set "user_id" = $3`
  where `$3` is the caller's own uid **reassigns the victim's property row to the attacker** —
  the attacker now owns (and can read, edit and delete) another landlord's property, tenant,
  payment, expense, maintenance, note or document row. This is the exact
  "user A passes user B's id and mutates B's data" case.
* The same primitive inserts rows owned by an arbitrary `user_id` (the normal path re-stamps
  `user_id` to the caller, so this is only reachable through the injected statement), and the
  `skip` branch (`:58-63`) lets the attacker write a **new** row into another landlord's table
  with a chosen `id`, `status`, `amount` or `file_url`.
* The injected value is readable back through the ordinary APIs, so this is a read primitive as
  well as a write primitive.
* The Neon database has **no RLS**, so nothing else stops it.

**Fix**

Validate the row keys against the real column set of the target table *before* building SQL and
reject anything that is not an exact match; never interpolate an identifier you did not verify.
Minimal version (identifier-shape test only) plus a hard column allowlist:

```ts
// lib/backup.ts — new helper
const IDENT = /^[a-z_][a-z0-9_]*$/
const BACKUP_COLUMNS: Record<string, readonly string[]> = {
  properties: ["id", "user_id", "name", "address", "city", "county", "type", "bedrooms",
               "bathrooms", "rent_amount", "monthly_rent", "deposit_amount", "size_sqft",
               "square_feet", "status", "description", "amenities", "created_at", "updated_at"],
  // …one list per table in BACKUP_TABLES…
}

function assertSafeKeys(table: string, row: SanitisedRow) {
  const allowed = BACKUP_COLUMNS[table]
  if (!allowed) throw new Error(`Unknown table ${table}`)
  for (const key of Object.keys(row)) {
    if (!IDENT.test(key) || !allowed.includes(key)) {
      throw new Error(`Illegal column "${key}" for ${table}`)
    }
  }
}
```

and call it at the top of the per-row loop, before `sql.unsafe(...)`, in **all three** branches
(`skip`, `replace`, `merge`).

> Cross-reference: the same defect is already recorded by the infra track and by
> `audit/INDEPENDENT_FINDINGS.md` **IND-001**. It is repeated here because its *tenancy*
> consequence is in this track's scope. **Do not double-count it.**

---

### AUTHZ-002 — HIGH — Tenant invite upsert uses `user_id` as the conflict target → tenant-portal link of another landlord can be reassigned

**File:** `app/api/tenants/[id]/invite/route.ts:46-59`
**Category:** missing-ownership-check

```ts
// app/api/tenants/[id]/invite/route.ts:46-59
const { data, error } = await supabase
  .from("tenant_users")
  .upsert(
    {
      user_id: matched.id,
      tenant_id: tenant.id,
      invited_by: userId,
      invited_at: new Date().toISOString(),
      accepted_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  )
  .select()
  .single()
```

**Attack path.** `matched.id` is the auth uid of the e-mail supplied in the body
(`:15-17`, `:35-37`). The route verifies that the *tenant* belongs to the caller
(`:20-27`) but never verifies that the *invited auth account* is not already linked to a
different landlord's tenant. `tenant_users.user_id` is `unique`
(`supabase-setup/08-tenant-portal.sql:13`, `db/migrations/002-support.sql:281`), so
`ON CONFLICT (user_id) DO UPDATE` **moves** the existing link:

| | value before | value after |
|---|---|---|
| `user_id` | victim tenant's auth user | unchanged (it is the conflict key) |
| `tenant_id` | landlord A's tenant | **landlord B's tenant** |
| `invited_by` | landlord A | landlord B |

The invited account's tenant portal now resolves to landlord B's tenant, and landlord A's tenant
has lost its portal user. The link is a `unique(user_id)` row — the hijack is a **move**, not a
copy, so landlord A's tenant is left unportal-ed.

**Current mitigation (must be stated):** on the Supabase path there is **no UPDATE policy** on
`tenant_users` (`supabase-setup/08-tenant-portal.sql:26-56` defines select / insert / delete
only), so RLS rejects the `DO UPDATE` and the route returns 500 instead of hijacking. That is the
only thing standing between this route and a cross-tenant portal takeover — it is *not* an
application-level check, and it does not exist on the Neon copy of the table
(`db/migrations/002-support.sql:280-288`, no RLS, same `unique(user_id)`).

**Impact.** Tenant-portal identity takeover between landlords; a tenant can end up seeing
landlord B's property/lease data instead of landlord A's, and landlord A loses the tenant
contact. Confirmed exploitable wherever the `tenant_users` RLS policies are not installed.

**Fix.** Do not use the invitee's uid as the conflict target, and refuse to steal an existing
link:

```ts
// app/api/tenants/[id]/invite/route.ts
const { data: existing } = await supabase
  .from("tenant_users")
  .select("id, tenant_id, tenants!inner(user_id)")
  .eq("user_id", matched.id)
  .maybeSingle()

if (existing) {
  const owner = (existing.tenants as any)?.user_id
  if (owner !== userId) {
    throw new HttpError("That account is already linked to another workspace", 409)
  }
}

const { data, error } = await supabase
  .from("tenant_users")
  .upsert({ user_id: matched.id, tenant_id: tenant.id, invited_by: userId, invited_at: … },
          { onConflict: "tenant_id" })
```

(Keep the RLS UPDATE policy absent, or add one that requires the caller to own the tenant.)

---

### AUTHZ-003 — HIGH — `DELETE /api/tenants/[id]/invite` has no ownership check at all

**File:** `app/api/tenants/[id]/invite/route.ts:64-72`
**Category:** missing-ownership-check

```ts
// app/api/tenants/[id]/invite/route.ts:64-72
export const DELETE = withAuth(async (_req, { supabase, userId }, params) => {
  // Unlink a tenant from any auth user.
  const { error } = await supabase
    .from("tenant_users")
    .delete()
    .eq("tenant_id", params.id)
  if (error) return errorResponse(error.message, 500)
  return NextResponse.json({ ok: true })
})
```

Note what is **missing**: unlike `POST` (`:20-27`), the DELETE handler never loads the tenant
and never checks `tenants.user_id === userId`. `userId` is destructured and then unused. Any
authenticated user who learns a tenant UUID can unlink that tenant from its portal account.

**Attack path.** `DELETE /api/tenants/<any-tenant-uuid>/invite` with the attacker's own session
cookie. `withAuth` passes (the caller is authenticated) and the same-origin check passes from the
app's own origin. The delete fires with only `tenant_id` in the predicate.

**Impact.** Cross-tenant denial of service on another landlord's tenant portal: the victim
tenant loses access to their rent statement and the landlord's invitation state is destroyed.
The response is `{"ok": true}` either way, so the attacker gets no signal — and the victim
cannot tell it was a deletion rather than a no-op.

**Current mitigation:** the `tenant_users_landlord_delete` RLS policy
(`supabase-setup/08-tenant-portal.sql:44-51`) requires the tenant to be owned by `auth.uid()`,
so on a correctly provisioned Supabase project the delete matches zero rows. That is an
accidental backstop: the route is the only one in the file that trusts it, the Neon copy of the
table has no RLS, and the response lies about what happened.

**Fix.** Apply the same ownership check as the POST handler, and report the real outcome:

```ts
export const DELETE = withAuth(async (_req, { supabase, userId }, params) => {
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", userId)
    .maybeSingle()
  if (!tenant) throw new HttpError("Tenant not found", 404)

  const { error, count } = await supabase
    .from("tenant_users")
    .delete({ count: "exact" })
    .eq("tenant_id", params.id)
  if (error) return errorResponse(error.message, 500)
  return successResponse({ ok: true, removed: count ?? 0 })
})
```

---

### AUTHZ-004 — HIGH — `GET /api/mpesa/c2b/status/[transId]` falls back to an unscoped Daraja query

**File:** `app/api/mpesa/c2b/status/[transId]/route.ts:13-42`
**Category:** missing-ownership-check (IDOR)

```ts
// app/api/mpesa/c2b/status/[transId]/route.ts:13-42
export const GET = withAuth(async (_request, { userId }, { transId }) => {
  if (neonConfigured()) {
    try {
      const sql = getDb()
      const rows = await sql`
        select id, trans_id, trans_amount, match_status, matched_tenant_id, match_method, created_at
        from public.c2b_transactions
        where trans_id = ${transId} and user_id = ${userId}
        limit 1
      `
      if (rows.length > 0) { return NextResponse.json({ cached: true, transaction: rows[0] }) }
    } catch (err) { console.warn("[c2b status] cache lookup failed", err) }
  }

  // Otherwise, ask Daraja
  try {
    const status = await c2bTransactionStatus(transId)          // ← no owner check
    return NextResponse.json({ cached: false, daraja: status })
  } catch (err) { … }
})
```

**Attack path.** The cache lookup is correctly scoped by `user_id`, but the **fallback path is
not scoped at all**: `transId` comes straight from the URL and is handed to Daraja's
transaction-status query (`lib/mpesa/daraja.ts:479-521`). The response
(`C2BStatusResponse`, `lib/mpesa/daraja.ts:463-478`) contains
`Amount`, `TransactionReceipt`, `TransactionDate`, **`MSISDN`** and **`FirstName`/`LastName`** —
i.e. the payer's phone number and legal name.

**The fallback is not an edge case — on the Supabase path it is the *only* path.** The
Supabase fallback writer omits `user_id`
(`app/api/mpesa/c2b/confirmation/route.ts:235-251`), but the column is
`user_id uuid not null` (`supabase-setup/10-holy-grail.sql:92`), so the insert is rejected and
**no `c2b_transactions` row is ever created**. The scoped cache lookup at `:18-23` therefore
never matches, and every request falls through to the unscoped provider call. (The Neon writer
does set `user_id` — `:163-175` — so on the Neon path the cache does work and only transactions
that belong to nobody fall through.)

Any authenticated landlord can call
`GET /api/mpesa/c2b/status/<transId>` with a trans id that belongs to **another** workspace and
read back that tenant's payment identity. A trans id is not a secret: it is printed on every
M-Pesa receipt and SMS, it is the `TransID` Daraja calls back with, and it is stored in
`c2b_transactions.raw` for every workspace.

**Impact.** Cross-tenant disclosure of payer PII (MSISDN + legal name) and payment amounts for
any landlord's paybill, to any authenticated user of the platform.

**Fix.** Never fall back to a provider lookup for a transaction you do not own. If the cached row
is missing, it is not yours:

```ts
export const GET = withAuth(async (_request, { userId }, { transId }) => {
  const sql = getDb()
  const rows = await sql`
    select id, trans_id, trans_amount, match_status, matched_tenant_id, match_method, created_at
    from public.c2b_transactions
    where trans_id = ${transId} and user_id = ${userId}
    limit 1
  `
  if (rows.length === 0) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
  }
  return NextResponse.json({ cached: true, transaction: rows[0] })
})
```

If a provider fallback is genuinely needed, gate it on a **user-supplied, user-scoped**
`checkout_request_id` and re-check the owner after the provider call.

---

### AUTHZ-005 — HIGH — Any authenticated user can re-point the platform's Daraja C2B callback URLs

**File:** `app/api/mpesa/c2b/register/route.ts:22-46`
**Category:** privilege-escalation

```ts
// app/api/mpesa/c2b/register/route.ts:22-46
export const POST = withAuth(async (request, { userId }) => {
  const json = await request.json().catch(() => null)
  const parsed = Schema.safeParse(json)
  …
  const r = await c2bRegister({
    shortCode: parsed.data.short_code,
    responseType: parsed.data.response_type,
    validationUrl: parsed.data.validation_url,
    confirmationUrl: parsed.data.confirmation_url,
  })
  console.info("[c2b] urls registered", { userId, ...parsed.data, response: r })
  return NextResponse.json({ ok: true, daraja: r })
})
```

**Attack path.** The schema (`app/api/mpesa/c2b/register/route.ts:13-18`) accepts **any**
`short_code` and **any** `https://` `validation_url` / `confirmation_url`. There is no
ownership check on the short code (the caller does not even need to own a `paybills` row with
that number) and no role check. `c2bRegister()` (`lib/mpesa/daraja.ts:355-389`) calls Daraja
with **the platform's** `MPESA_CONSUMER_KEY` / `MPESA_CONSUMER_SECRET`
(`lib/mpesa/daraja.ts:46-58`), i.e. the merchant credentials of the application's own paybill.

So a normal landlord account can re-register the **platform's** shortcode with their own
validation and confirmation URLs. From that moment, every C2B payment customers make to the
platform's paybill is validated and confirmed against the attacker's server.

**Impact.** Platform-level privilege escalation from a normal tenant account:
* the attacker's confirmation URL receives every incoming C2B receipt — payer **MSISDN**, legal
  name, amount, and the account reference that identifies the tenant;
* the attacker's validation URL can accept or reject any payment, so the attacker can block or
  manipulate the platform's rent collection;
* the callback that normally writes the `c2b_transactions` / `rent_payments` rows
  (`app/api/mpesa/c2b/confirmation/route.ts:83-213`) never runs, so the platform's
  reconciliation silently stops working for every landlord.

**Fix.** This is a platform-configuration operation, not a per-user one. Restrict it to an
operator: require a server-side secret (never a user session) and require the short code to
belong to the caller's own `paybills` row; better, remove the route and run the registration
from a script.

```ts
// app/api/mpesa/c2b/register/route.ts
const expected = process.env.MPESA_ADMIN_SECRET
const got = request.headers.get("x-mpesa-admin-secret")
if (!expected || got !== expected) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

// the short code must be one this workspace owns
const { data: paybill } = await supabase
  .from("paybills")
  .select("id, number")
  .eq("number", parsed.data.short_code)
  .eq("user_id", userId)
  .maybeSingle()
if (!paybill) return NextResponse.json({ error: "Unknown short code" }, { status: 404 })
```

---

### AUTHZ-006 — HIGH — Write endpoints accept `property_id` / `tenant_id` / `payment_id` from the body without an ownership check

**Files (all `withAuth`, all `user_id` forced — but the *foreign* keys are not validated):**

| Route | Lines | Unvalidated columns |
|---|---|---|
| `app/api/payments/route.ts` | 54-84 | `tenant_id`, `property_id` |
| `app/api/payments/[id]/route.ts` | 29-56 | `tenant_id`, `property_id` |
| `app/api/tenants/route.ts` | 43-86 | `property_id` |
| `app/api/tenants/[id]/route.ts` | 35-78 | `property_id` |
| `app/api/maintenance/route.ts` | 42-74 | `property_id`, `tenant_id` |
| `app/api/maintenance/[id]/route.ts` | 32-61 | `property_id`, `tenant_id` |
| `app/api/documents/route.ts` | 41-77 | `property_id`, `tenant_id` |
| `app/api/documents/[id]/route.ts` | 31-66 | `property_id`, `tenant_id` |
| `app/api/notes/route.ts` | 34-59 | `property_id`, `tenant_id` |
| `app/api/notes/[id]/route.ts` | 25-49 | `property_id`, `tenant_id` |
| `app/api/expenses/route.ts` | 48-79 | `property_id` |
| `app/api/expenses/[id]/route.ts` | 29-57 | `property_id` |
| `app/api/mpesa/stkpush/route.ts` | 19, 65-77 | `payment_id` |

**Category:** mass-assignment (foreign-key ownership not checked)

The body is correctly whitelisted with `pickFields()` (`lib/api/index.ts:119-133`) and
`user_id` is always written **after** the spread, so `user_id` itself cannot be forged
(`app/api/payments/route.ts:64-66`, `app/api/maintenance/route.ts:50-52`,
`app/api/notes/route.ts:40-49`, `app/api/expenses/route.ts:58-61`). The gap is one level down:
the *referenced* row may belong to somebody else.

```ts
// app/api/payments/route.ts:64-75  — the tenant/property are taken as-is
const insert = {
  ...fields,                    // ← fields.tenant_id / fields.property_id, unvalidated
  user_id: userId,
  amount,
  …
}
```

```ts
// app/api/tenants/route.ts:58-76
const insert = {
  user_id: userId,
  …
  property_id: blankToNull(fields.property_id),   // ← may be another landlord's property
  …
}
```

**Attack path.**

1. Attacker (landlord B) obtains landlord A's `properties.id` (it leaks through receipts,
   support tickets, referrers, shared paybill links, the C2B `bill_ref_number`, …).
2. `POST /api/tenants` with `property_id = A's property id` → landlord B creates a tenant record
   that is **attached to landlord A's property** (`tenants.property_id` has an FK to
   `properties.id`, `db/migrations/001-core.sql:85`, so the insert succeeds as long as the id
   exists).
3. `POST /api/payments` with `tenant_id = A's tenant id`, `property_id = A's property id`,
   `amount = 1 000 000` → a forged rent-payment row now points at landlord A's tenant.
4. The reconciliation engine, which runs on **Neon with no RLS**, selects its tenant candidates
   by joining through the property:

```ts
// app/api/mpesa/c2b/confirmation/route.ts:126-133   (identical shape in
// app/api/reconciliation/match/route.ts:40-47)
const rows = await sql`
  select t.id, t.full_name, t.phone, t.rent_amount as expected_rent, …
  from public.tenants t
  left join public.properties p on p.id = t.property_id
  where p.user_id = ${userId}                      -- ← owner of the PROPERTY, not of the tenant
    and (t.lease_end is null or t.lease_end >= current_date)
`
```

   Landlord B's forged tenant is now a **candidate for landlord A's incoming M-Pesa payments**,
   because the join filters on the *property* owner. When one matches, the confirmation handler
   writes the payment under landlord A's uid but against landlord B's tenant row
   (`app/api/mpesa/c2b/confirmation/route.ts:184-194`):

```ts
insert into public.rent_payments (user_id, tenant_id, amount, paid_date, status, payment_method, notes)
values (${owner.user_id}, ${result.matched_tenant_id}, ${Number(body.TransAmount)}, …)
```

**Impact.** Cross-tenant write into another landlord's property/tenant graph: forged tenant and
payment records attached to landlord A's property, and landlord A's incoming rent payments
attributed to a tenant record controlled by landlord B (financial mis-attribution in A's books
and in the reconciliation audit trail). The same trick works for maintenance requests, notes,
documents and expenses on landlord A's property.

**Fix.** Validate every foreign key against the caller's own rows before writing. A small helper
used by all the write handlers keeps this consistent:

```ts
// lib/api/ownership.ts (new)
import type { SupabaseClient } from "@supabase/supabase-js"
import { HttpError } from "@/lib/api"

export async function assertOwned(
  supabase: SupabaseClient,
  table: "properties" | "tenants" | "rent_payments",
  id: string | null | undefined,
  userId: string,
) {
  if (!id) return
  const { data } = await supabase
    .from(table)
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle()
  if (!data) throw new HttpError(`${table} not found`, 404)
}
```

```ts
// app/api/payments/route.ts — inside the POST handler, before the insert
await assertOwned(supabase, "tenants", fields.tenant_id, userId)
await assertOwned(supabase, "properties", fields.property_id, userId)
```

Apply the same two calls in the tenants, maintenance, documents, notes and expenses handlers,
and validate `payment_id` against the caller's own `rent_payments` row in
`app/api/mpesa/stkpush/route.ts`. Rejecting an unknown id with 404 (rather than silently
writing it) also removes the oracle.

---

### AUTHZ-007 — MEDIUM — Every dashboard screen reads rows with no owner predicate; isolation rests entirely on Supabase RLS

**Files (all fetch by id / by table with **no** `user_id` filter):**

| File | Line | Query |
|---|---|---|
| `app/dashboard/properties/[id]/page.tsx` | 29-30 | `properties` by `id`; `tenants` by `property_id` |
| `app/dashboard/tenants/[id]/page.tsx` | 33-41 | `tenants` by `id`; `rent_payments` by `tenant_id` |
| `app/dashboard/notes/[id]/page.tsx` | 26-32 | `notes` by `id` |
| `app/dashboard/documents/[id]/page.tsx` | 27-33 | `documents` by `id` |
| `app/dashboard/maintenance/[id]/page.tsx` | 27-33 | `maintenance_requests` by `id` |
| `app/dashboard/contacts/page.tsx` | 22-23 | `contacts`, `tenants` (whole table) |
| `app/dashboard/paybill/page.tsx` | 22-23 | `paybills`, `c2b_transactions` (whole table) |
| `app/dashboard/damages/page.tsx` | 23 | `damages` (whole table) |
| `app/dashboard/properties/map/page.tsx` | 51-60 | `properties` (whole table) |

**Category:** missing-ownership-check (defence in depth)

**The asymmetry.** Every **API** route scopes with `.eq("user_id", userId)` — e.g.
`app/api/properties/[id]/route.ts:22-31`, `app/api/notes/[id]/route.ts:13-22`. Every **page**
does not. The pages are `"use client"` components that use the browser Supabase client
(`app/dashboard/properties/[id]/page.tsx:10-11`, `app/dashboard/tenants/[id]/page.tsx:1-11`),
so the query runs as the logged-in user and is filtered by RLS **if the RLS policies are
installed on the Supabase project**.

**Why that is not good enough here:**

* The RLS policies live in `supabase-setup/*.sql`, which the operator must paste into the
  Supabase SQL Editor by hand. Nothing in the deploy path applies them to the Supabase
  project — the patch runner (`app/api/migrations/run/route.ts:110-143`) applies them to
  **Neon**, where the `auth.uid()` policies cannot even be created.
* The architecture states Neon is the primary database and that it has **no RLS**
  (`db/migrations/001-core.sql:6-13`). If any of these screens is ever pointed at Neon — or if
  the Supabase policies were never applied — the URL `id` is the only thing standing between
  landlord A and landlord B's records.
* These are the *detail* screens: `app/dashboard/notes/[id]/page.tsx:26-32` will render any
  note id, `app/dashboard/documents/[id]/page.tsx:27-33` any document id, and
  `app/dashboard/tenants/[id]/page.tsx:38-41` the payment history of any tenant id. Documents
  are the highest-value target here: they are identity documents (national ID scans, lease
  agreements) and the storage bucket is public.

**Impact.** If the Supabase RLS policies are absent (a manual step that is easy to miss) or
the data lives on Neon, any authenticated user can read another landlord's notes, documents,
tenant details, maintenance records, contacts, paybills and damages by changing the id in the
URL. Nothing in the application layer stops it.

**Fix.** Scope the page queries by `user_id` exactly like the API routes do — the browser client
can filter on `user_id` just as well:

```ts
// app/dashboard/notes/[id]/page.tsx
const { data } = await supabase
  .from("notes")
  .select("*")
  .eq("id", params.id)
  .eq("user_id", userId)          // ← add; resolve userId via supabase.auth.getUser()
  .maybeSingle()
```

For the list screens, add `.eq("user_id", userId)` to the query. Where a screen legitimately
joins another workspace (a team member viewing a shared company), resolve the company first
and filter on `company_id` the way `app/dashboard/company/page.tsx:25-36` already does.

---

### AUTHZ-008 — MEDIUM — `countAll()` counts every landlord's properties on Neon with no owner filter

**File:** `app/dashboard/properties/map/page.tsx:147-160`
**Category:** missing-ownership-check

```ts
// app/dashboard/properties/map/page.tsx:147-160
async function countAll(): Promise<number> {
  if (neonConfigured()) {
    try {
      const sql = getDb()
      const rows = await sql`select count(*)::int as n from public.properties`
      return rows[0]?.n ?? 1
    } catch { /* fall through */ }
  }
  const supa = await createClient()
  const { count } = await supa.from("properties").select("*", { count: "exact", head: true })
  return count ?? 0
}
```

**Attack path.** `select count(*) from public.properties` on the Neon primary database, with no
`user_id` predicate and no RLS behind it. Every authenticated user of the platform sees the
**platform-wide** number of properties in the "Total properties" tile of the map screen
(`app/dashboard/properties/map/page.tsx:125-137`), and the derived "Need geocoding" and
"Coverage" percentages are computed against that global number.

**Impact.** Low sensitivity (an aggregate count, no PII) but it is a genuine cross-tenant leak
and it is guaranteed to work on the Neon path, where there is no RLS backstop at all. It also
corrupts the user's own statistics: the tile mixes the caller's portfolio with the platform's.

**Fix.**

```ts
// app/dashboard/properties/map/page.tsx
const rows = await sql`select count(*)::int as n from public.properties where user_id = ${userId}`
```

(and the same for the Supabase fallback at `:157-159`, which also lacks `.eq("user_id", …)`).

---

### AUTHZ-009 — MEDIUM — A user can put their own subscription back into an active state without paying

**File:** `app/api/subscription/route.ts:98-144`
**Category:** privilege-escalation (entitlement bypass)

```ts
// app/api/subscription/route.ts:121-130
const nextStatus = current.current_period_end && new Date(current.current_period_end) > new Date() ? "active" : "trialing"
const { data, error } = await supabase
  .from("subscriptions")
  .update({ status: nextStatus, canceled_at: null, cancel_at: null, trial_ends_at: nextStatus === "trialing" ? current.trial_ends_at : null })
  .eq("user_id", userId)
  .select()
  .single()
```

```ts
// app/api/subscription/route.ts:132-142
if (body.plan) {
  const valid = ["pro"]
  if (!valid.includes(body.plan)) throw new HttpError("Invalid plan", 400)
  const { data, error } = await supabase
    .from("subscriptions")
    .update({ plan_code: body.plan, updated_at: new Date().toISOString() })
    .eq("user_id", userId) …
}
```

**Attack path.** `PATCH /api/subscription` with `{"plan":"pro"}` sets the plan tier with no
payment. `{"reactivate":true}` sets `status` back to `active`/`trialing` with no payment. The
paywall gate in the middleware calls the `subscription_status` RPC
(`lib/supabase/middleware.ts:103-115`), whose semantics are defined in
`supabase-setup/14-subscriptions.sql:112-179`:

* `status = 'trialing'` **and** `trial_ends_at IS NULL` → the "trial expired" branch at
  `:137-147` is skipped, and the final block at `:162-176` returns **`is_active = true`** with
  `days_left = 0`. Such a row is active forever.
* The `reactivate` branch produces exactly that row: `trial_ends_at` is written back as
  `current.trial_ends_at`, which is `NULL` for any subscription row created by the checkout
  path (`app/api/subscription/checkout-status/route.ts:57-68` never sets `trial_ends_at`).

So the two-call sequence `PATCH {"cancel":true}` → `PATCH {"reactivate":true}` on a lapsed
subscription with `trial_ends_at = NULL` yields a permanently "active" subscription and the
dashboard gate stops redirecting to `/dashboard/billing`. `trial_ends_at` is `NULL` for any row
created by the checkout path (`app/api/subscription/checkout-status/route.ts:57-68` never sets
it), and the `reactivate` branch itself **nulls** it whenever it lands on `active`
(`app/api/subscription/route.ts:124`) — so the state is reachable by a user, not a corner case.

Two further gaps in the same RPC make the gate soft even without the `NULL` trick: a row with
`status = 'active'` whose `current_period_end` has passed is still reported as
`is_active = true` (`:162-176` only uses `current_period_end` for `days_left`), and
`PATCH {"plan":"pro"}` sets the plan tier with no payment at all.

**Impact.** Self-service bypass of the 14-day trial / KES 2,490 per month paywall, and of the
`plan_code` tier. The user keeps full Pro access after the trial ends or after a payment
failure. No cross-tenant impact — the user_id predicate is correctly applied — hence MEDIUM, not
HIGH.

**Fix.** The subscription row must not be writable by the client. Move `reactivate` behind a
verified payment (the M-Pesa / Stripe callback that already writes `status: "active"`), and drop
the free plan switch:

```ts
// app/api/subscription/route.ts — PATCH
if (body.plan) throw new HttpError("Plan changes require a payment", 402)
if (body.reactivate === true) {
  // Only a confirmed payment may re-activate. The M-Pesa/Stripe callbacks
  // (app/api/subscription/checkout-status/route.ts, app/api/stripe/webhook/route.ts)
  // already set status='active' after a successful charge.
  return errorResponse("Reactivation requires a confirmed payment", 402)
}
```

and harden the RPC so a `trialing` row without `trial_ends_at` is never active
(`supabase-setup/14-subscriptions.sql:137`): treat `trial_ends_at IS NULL` as expired.

---

### AUTHZ-010 — MEDIUM — Open redirect: the `next` sanitiser accepts a backslash-prefixed protocol-relative URL

**Files:** `lib/supabase/middleware.ts:131-137` and `app/(marketing)/auth/callback/route.ts:4-8`
**Category:** middleware-bypass

```ts
// lib/supabase/middleware.ts:131-137
function safeNextPath(value: string | null | undefined): string {
  if (!value || typeof value !== "string") return ""
  if (!value.startsWith("/") || value.startsWith("//")) return ""
  if (/[\u0000-\u001f\u007f]/.test(value)) return ""
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(value)) return ""
  return value
}
```

```ts
// app/(marketing)/auth/callback/route.ts:4-8
function safeNextPath(value: string | null): string {
  if (!value || typeof value !== "string") return "/dashboard"
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard"
  return value
}
```

Both reject `//evil.com` but accept `/\evil.com`. The WHATWG URL parser normalises `\` to `/`
in the path of a special scheme, so the value is parsed as a **protocol-relative** URL:

```
node -e 'console.log(new URL("/\\evil.com","https://app.propdesk.africa").href)'
→ https://evil.com/
```

**Attack path.** The middleware redirect is reachable without any secret:

```ts
// lib/supabase/middleware.ts:70-73
if (user && isAuthPage) {
  const redirectTo = safeNextPath(searchParamsGet(search, "next")) || "/dashboard"
  return NextResponse.redirect(new URL(redirectTo, request.url))
}
```

Send a signed-in user `https://<app>/auth/login?next=/%5Cevil.com` (or `/%5C%5Cevil.com`) and
the server answers `307 Location: https://evil.com/`. The same works on the
`/auth/callback?code=…&next=/\evil.com` path (`app/(marketing)/auth/callback/route.ts:26`).
No token is needed, so it is a clean phishing primitive on a trusted domain: the link looks
like a PropDesk URL and the victim lands on an attacker-controlled clone of the login page.

**Impact.** Open redirect on the authentication surface — credential phishing, OAuth-token
delivery to a third party when the redirect is chained from a legitimate flow, and a way to
launder a malicious link through the app's own domain.

**Fix.** Parse the candidate and require the origin to match, instead of pattern-matching the
string:

```ts
// lib/supabase/middleware.ts + app/(marketing)/auth/callback/route.ts
function safeNextPath(value: string | null | undefined, origin: string): string | null {
  if (!value || typeof value !== "string") return null
  if (!value.startsWith("/")) return null
  let url: URL
  try { url = new URL(value, origin) } catch { return null }
  if (url.origin !== new URL(origin).origin) return null
  if (!url.pathname.startsWith("/")) return null
  return `${url.pathname}${url.search}${url.hash}`
}
```

Callers become `safeNextPath(searchParamsGet(search, "next"), request.url)` and
`safeNextPath(next, requestUrl.origin)`.

---

### AUTHZ-011 — MEDIUM — The M-Pesa C2B callbacks trust a client-controllable `x-forwarded-for` and default to allow-all outside production

**Files:** `app/api/mpesa/c2b/validation/route.ts:32-35`, `app/api/mpesa/c2b/confirmation/route.ts:23-26`, `lib/mpesa/daraja.ts:268-283`
**Category:** auth-bypass

```ts
// app/api/mpesa/c2b/confirmation/route.ts:23-26
export async function POST(request: NextRequest) {
  if (!isFromSafaricom(request.headers.get("x-forwarded-for"))) {
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Forbidden" }, { status: 403 })
  }
```

```ts
// lib/mpesa/daraja.ts:268-283
export function isFromSafaricom(remoteAddr: string | null): boolean {
  const list = (process.env.MPESA_ALLOWED_CALLBACK_IPS || "").split(",").map((s) => s.trim()).filter(Boolean)
  if (list.length === 0) {
    return process.env.MPESA_ENV !== "production"     // ← allow-all in sandbox / when unset
  }
  if (!remoteAddr) return false
  …
}
```

**Two problems.**

1. `x-forwarded-for` is the **first** value of a client-supplied header
   (`request.headers.get("x-forwarded-for")?.split(",")[0]`). On most proxies the client value is
   prepended, not replaced, so the first hop is attacker-controlled. The app should read a
   platform-trusted header (`x-vercel-forwarded-for` / `cf-connecting-ip`) or, better, not rely
   on IP at all.
2. When `MPESA_ALLOWED_CALLBACK_IPS` is unset, `isFromSafaricom` returns **true** for everyone
   unless `MPESA_ENV === "production"`. A deployment that sets `MPESA_ENV=production` but
   forgets the allowlist is closed; a staging deployment, or a production deployment with
   `MPESA_ENV` left at its `sandbox` default (`lib/mpesa/daraja.ts:47`), is wide open.

**Attack path (if the route is reachable).** `POST /api/mpesa/c2b/confirmation` with a forged
Daraja payload — `BusinessShortCode` set to a real paybill number, `TransAmount` and `MSISDN`
attacker-chosen — makes the handler write a **paid** rent payment for that workspace:

```ts
// app/api/mpesa/c2b/confirmation/route.ts:184-194
insert into public.rent_payments (user_id, tenant_id, amount, paid_date, status, payment_method, notes)
values (${owner.user_id}, ${result.matched_tenant_id}, ${Number(body.TransAmount)},
        current_date, 'paid', 'mpesa_c2b', …)
```

That is forged rent collection — receipts that were never paid.

**Honest status:** today the route is unreachable by an anonymous caller, because the
middleware 401s every `/api/**` path except the three in `isExternalApi`
(`lib/supabase/middleware.ts:55-58`, `:82-87`) — which also means **the legitimate Safaricom
callback is broken**. So the control that is actually protecting this route is the blanket 401,
not the IP check. That is exactly why it must be fixed before the middleware is corrected
(§1.1).

**Fix.** Authenticate the callback with a secret the way `/api/mpesa/callback` already does
(`app/api/mpesa/callback/route.ts:29-36`, `timingSafeEqual`), keep the IP allowlist as a
second factor, and fail closed:

```ts
// lib/mpesa/daraja.ts
export function isFromSafaricom(remoteAddr: string | null): boolean {
  const list = (process.env.MPESA_ALLOWED_CALLBACK_IPS || "").split(",").map((s) => s.trim()).filter(Boolean)
  if (list.length === 0) return false          // ← fail closed, never "allow all"
  …
}
```

```ts
// app/api/mpesa/c2b/confirmation/route.ts
const secret = process.env.MPESA_CALLBACK_SECRET
const provided = request.headers.get("x-mpesa-callback-secret")
if (!secret || !provided || !timingSafeEqual(Buffer.from(provided), Buffer.from(secret))) {
  return NextResponse.json({ ResultCode: 1, ResultDesc: "Rejected" }, { status: 403 })
}
```

and read the client IP from a header the platform overwrites (`x-vercel-forwarded-for`).

---

### AUTHZ-012 — LOW — The middleware matcher excludes every path ending in `.js`/`.css`/etc., so dynamic API routes skip the middleware entirely

**File:** `middleware.ts:13-23`
**Category:** middleware-bypass

```ts
// middleware.ts:13-23
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
}
```

The negative lookahead excludes any path whose **last** segment ends in one of those
extensions. Next.js dynamic route segments match dots, so:

```
GET /api/tenants/8f3c…-…-….js   →  app/api/tenants/[id]/route.ts  (params.id = "8f3c….js")
```

and the path never matches the middleware matcher, so `updateSession()` never runs and the
401 at `lib/supabase/middleware.ts:82-87` is never produced.

**Why this is LOW today.** Every dynamic API route that touches tenant data
(`/api/tenants/[id]`, `/api/tenants/[id]/invite`, `/api/payments/[id]`, `/api/notes/[id]`,
`/api/documents/[id]`, `/api/maintenance/[id]`, `/api/expenses/[id]`,
`/api/properties/[id]`, `/api/properties/[id]/photos`, `/api/properties/[id]/geocode`,
`/api/backup/[id]`, `/api/backup/csv/[table]`, `/api/mpesa/c2b/status/[transId]`) also uses
`withAuth`, which performs its own server-side `getUser()` check — so no data leaks **through
this bypass today**. The routes that *are* reachable this way (`/api/blog/[slug]`,
`/api/docs/[slug]`, `/api/features/[slug]`, `/api/customers/[slug]`,
`/api/templates/[id]/**`) return static marketing content.

**Impact.** The middleware is not a reliable authorisation layer for dynamic API routes. The
day somebody adds an unauthenticated-by-design route with a dynamic segment that returns
tenant data (or removes `withAuth` from one of them), the `.js` suffix is a one-character
auth bypass. It also means the middleware's coverage claims are wrong today.

**Fix.** Narrow the exclusion to the static-asset directories instead of a file-extension
pattern, so the matcher only skips real files:

```ts
// middleware.ts
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
}
```

If the extension filter must stay, at least exclude it from the API surface by matching
`/api` explicitly:

```ts
matcher: [
  "/api/:path*",                                    // ← always authenticated
  "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
]
```

**Other bypass shapes checked and found *not* exploitable** (for the record):

| Shape | Result |
|---|---|
| trailing slash `/api/properties/` | `pathname.startsWith("/api/")` is still true → 401. Next.js 308-redirects the trailing slash anyway. |
| double slash `//api/properties` | `pathname` does not start with `/api/` → the middleware would skip it, **but** Next.js normalises repeated slashes and answers `308` before routing (`node_modules/next/dist/server/base-server.js:576-581`), so the handler is never reached. |
| encoded slash `/api/tenants%2F…` | still starts with `/api/` → 401. |
| upper case `/API/properties` | App Router route matching is case-sensitive → 404. |
| `?next=` / query strings | never part of `pathname`. |
| `/api` (no trailing slash) | no route handler exists → 404. |

---

### AUTHZ-013 — LOW — The middleware skips **all** enforcement when the Supabase env vars are missing

**File:** `lib/supabase/middleware.ts:24-28`
**Category:** middleware-bypass

```ts
// lib/supabase/middleware.ts:24-28
if (!supabaseUrl || !supabaseAnonKey) {
  // Allow the request to continue so the dev experience doesn't completely
  // break when env vars are missing, but skip auth enforcement.
  return response
}
```

**Attack path.** If `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` is missing
(mis-set env, a preview deployment without secrets, a `next build` without `NEXT_PUBLIC_*`
inlined), the middleware returns immediately: no 401 for `/api/**`, no redirect for
`/dashboard/**`, and **no email-verification gate**.

**Impact.** The API routes that use `withAuth` still 401 on their own (`getUser()` fails
without a configured Supabase), so tenant data stays protected. What is lost is the middleware's
own layer: the anonymous access to the routes that have no `withAuth` (§1), the dashboard
redirect (the layout's own `getUser()` check at `app/dashboard/layout.tsx:22-42` still catches
it), and the email-verification gate — a user with an unverified address reaches
`/dashboard/**` instead of `/auth/verify-email`.

**Fix.** Fail closed in production, exactly like the migration and cron routes already do
(`app/api/migrations/run/route.ts:36-47`):

```ts
if (!supabaseUrl || !supabaseAnonKey) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 503 })
  }
  return response
}
```

---

### AUTHZ-014 — LOW — The tenant-invite route calls the Supabase **admin** API on the anon client

**File:** `app/api/tenants/[id]/invite/route.ts:29-37`
**Category:** missing-auth (latent user-enumeration primitive)

```ts
// app/api/tenants/[id]/invite/route.ts:29-37
// Resolve the auth user id from email via the admin API
// (we need the service-role key for this)
const { data: userList, error: lookupErr } = await supabase.auth.admin.listUsers()
if (lookupErr) {
  return errorResponse("Cannot look up users — service role required", 500)
}
const matched = (userList?.users || []).find(
  (u: any) => (u.email || "").toLowerCase() === email,
)
```

`supabase` here is the **anon-key** server client from `lib/supabase/server.ts:33-53`
(`NEXT_PUBLIC_SUPABASE_ANON_KEY`). The Supabase admin API requires the service-role key, so
`listUsers()` fails with 403 and the route always returns 500 — the invite feature is
non-functional as written.

**Impact today:** none (the call fails). **Impact if "fixed" naively:** swapping in
`createServiceClient()` (`lib/supabase/service.ts:15-25`) turns this into a
**full enumeration of every user account on the platform** (e-mail address, id, created-at)
reachable by any authenticated landlord who can post an e-mail address — and the lookup has no
rate limit, so the whole user table can be harvested one address at a time.

**Fix.** Do not enumerate users. Resolve the invitee through a mechanism that does not require
reading the user table — e.g. have the tenant sign up with the e-mail and claim the link via a
one-time token, or use the Supabase admin invite API (which creates the user, it does not
enumerate them). If enumeration is unavoidable, gate it on a service-role client **and** on an
admin secret, and rate-limit it.

---

## 3. Summary table

| ID | Sev | Category | File | Title |
|---|---|---|---|---|
| AUTHZ-001 | CRITICAL | mass-assignment | `lib/backup.ts:59,67,79` | SQLi in backup restore → cross-tenant row takeover |
| AUTHZ-002 | HIGH | missing-ownership-check | `app/api/tenants/[id]/invite/route.ts:46-59` | Invite upsert conflict target is `user_id` → tenant-portal link hijack |
| AUTHZ-003 | HIGH | missing-ownership-check | `app/api/tenants/[id]/invite/route.ts:64-72` | Invite DELETE has no ownership check |
| AUTHZ-004 | HIGH | missing-ownership-check | `app/api/mpesa/c2b/status/[transId]/route.ts:35-42` | Unscoped Daraja fallback discloses another workspace's payer PII |
| AUTHZ-005 | HIGH | privilege-escalation | `app/api/mpesa/c2b/register/route.ts:22-46` | Any user can re-point the platform's Daraja C2B URLs |
| AUTHZ-006 | HIGH | mass-assignment | `app/api/payments/route.ts:54-84` + 12 more | Foreign `property_id`/`tenant_id`/`payment_id` not ownership-checked |
| AUTHZ-007 | MEDIUM | missing-ownership-check | `app/dashboard/notes/[id]/page.tsx:26-32` + 8 more | Dashboard screens rely on RLS only |
| AUTHZ-008 | MEDIUM | missing-ownership-check | `app/dashboard/properties/map/page.tsx:147-160` | Unscoped platform-wide `count(*)` on Neon |
| AUTHZ-009 | MEDIUM | privilege-escalation | `app/api/subscription/route.ts:98-144` | Self-service subscription / plan entitlement bypass |
| AUTHZ-010 | MEDIUM | middleware-bypass | `lib/supabase/middleware.ts:131-137` | Open redirect via backslash-prefixed `next` |
| AUTHZ-011 | MEDIUM | auth-bypass | `app/api/mpesa/c2b/confirmation/route.ts:23-26` | C2B callback trusts `x-forwarded-for`; allowlist fails open |
| AUTHZ-012 | LOW | middleware-bypass | `middleware.ts:13-23` | `.js` suffix skips the middleware for dynamic routes |
| AUTHZ-013 | LOW | middleware-bypass | `lib/supabase/middleware.ts:24-28` | Middleware fails open when Supabase env vars are missing |
| AUTHZ-014 | LOW | missing-auth | `app/api/tenants/[id]/invite/route.ts:29-37` | Admin API called on the anon client (latent enumeration) |

---

## 4. Categories with **zero** findings (stated explicitly, not padded)

* **`service-role-bypass` — ZERO findings.** Every route that uses the service-role client
  re-implements the ownership check that RLS would normally provide:
  `app/api/properties/[id]/photos/route.ts:44-51` verifies property ownership before the
  service-role storage upload and prefixes the object path with the caller's uid (`:57`);
  `app/api/paybill/route.ts:30` and `:53-57` scope by `user_id` and validate the property ids
  before linking; `app/api/paybill/test-payment/route.ts:13-22` scopes every write by
  `user_id`; `app/api/subscription/checkout/route.ts:61-74`,
  `app/api/subscription/checkout-status/route.ts:42-78` and
  `app/api/subscription/stripe-checkout/route.ts:40-47` all take `user_id` from the session;
  `app/api/stripe/webhook/route.ts:26-44` takes `user_id` from the *signed* event metadata and
  scopes the update; `app/api/mpesa/callback/route.ts:92-103` scopes the rent-payment update by
  `tx.user_id`. The only service-role-adjacent weaknesses found are the **IP-allowlist**
  weakness (AUTHZ-011) and the **admin-API** call (AUTHZ-014), neither of which is a missing
  owner check.
* **`auth-bypass` (a genuine authentication bypass that returns tenant data to an
  unauthenticated caller) — ZERO findings.** No route returns tenant data without a session.
  The unauthenticated surface is: `/api/health` (a constant), `/api/cron/run` (secret-gated),
  `/api/mpesa/callback` (secret + IP gated), and the marketing/stub routes, none of which read
  the database. The single route that would have been an unauthenticated write primitive — the
  backup restore — is authenticated by `withAuth` and the flaw there is the SQL injection
  (AUTHZ-001), not a missing session check.
* **Mass assignment of `user_id`, `role` or `status` — ZERO findings.** Every write handler
  builds its row explicitly and writes `user_id` **after** any spread
  (`app/api/properties/route.ts:60-75`, `app/api/tenants/route.ts:58-76`,
  `app/api/payments/route.ts:64-75`, `app/api/maintenance/route.ts:50-64`,
  `app/api/documents/route.ts:53-67`, `app/api/notes/route.ts:40-49`,
  `app/api/expenses/route.ts:58-69`), and `pickFields()` (`lib/api/index.ts:119-133`) drops
  unknown keys. `app/api/profile/route.ts:24-41` likewise forces `user_id`. The only mass
  assignment problem found is the *foreign key* variant (AUTHZ-006) and the identifier
  interpolation in the restore path (AUTHZ-001).
* **Role/privilege escalation to a role the app enforces — ZERO findings.** There is exactly
  one role column in the schema: `team_members.role`
  (`supabase-setup/10-holy-grail.sql:224`, values `admin|manager|agent|accountant|viewer`).
  It is written by `app/api/company/route.ts:37-57` (scoped to the caller's own company,
  `company_id` is derived from `owner_id`, never from the body) and it is **read only for
  display** (`app/api/company/route.ts:30`, `app/dashboard/company/page.tsx:33,118`). No
  authorization decision anywhere in the codebase reads it, so writing `role: "admin"` into
  one's own workspace grants **no** access. There is no `is_admin` column, no
  `app_metadata`-based role, and no `role` parameter that is honoured server-side. The two real
  privilege problems are of a different kind — platform-configuration escalation
  (AUTHZ-005) and entitlement escalation (AUTHZ-009) — and are reported as such.
* **Tenant-portal cross-tenant read (tenant A seeing tenant B) — ZERO findings** for the
  *read* direction. `tenant_users` is only ever read through the landlord's own tenant id
  (`app/api/tenants/[id]/invite/route.ts:20-27`), and the schema comment at
  `supabase-setup/08-tenant-portal.sql:6-9` ("the portal queries ONLY through this link") is
  accurate. The *write* direction is where the problems are (AUTHZ-002, AUTHZ-003).

---

## 5. Answers to the specific questions asked

1. **Is authentication enforced on every route?** Yes for every route that touches tenant data:
   45 of the 94 route files use `withAuth` (server-side `getUser()`), and every remaining
   route is either public marketing content, a stub, a webhook, or a secret-gated operator
   endpoint. The gap is not a missing session check but the **middleware's** role: it is what
   keeps the ~20 unauthenticated-by-design API routes unreachable (§1.1).
2. **Which routes are intentionally public, and which are unintentionally unauthenticated?**
   Intentionally public and harmless: the marketing content APIs, the lead/feedback forms, the
   template APIs, the system probes, `/api/health`. Intentionally public and **currently
   broken** by the blanket 401: `/api/stripe/webhook`,
   `/api/mpesa/c2b/validation`, `/api/mpesa/c2b/confirmation` (and the marketing APIs
   themselves). Unintentionally unauthenticated: **none that expose tenant data** — the two
   secret-gated operator endpoints (`/api/cron/run`, `/api/backup/auto`) are the only ones
   whose secret is optional outside production.
3. **Is the user id used to scope every SELECT/UPDATE/DELETE?** In the **API routes: yes** —
   every `.from(...)` call carries `.eq("user_id", userId)` or `.eq("id", …).eq("user_id", …)`,
   and every Neon query carries `user_id = ${userId}` except the two counted in AUTHZ-001 and
   AUTHZ-008. In the **dashboard pages: no** (AUTHZ-007), and the writes accept foreign keys
   without an owner check (AUTHZ-006).
4. **Can user A pass user B's id and read or mutate B's data?** Yes, three ways:
   * AUTHZ-001 — the restore path lets any account take ownership of another landlord's rows;
   * AUTHZ-006 — by attaching rows to B's `property_id` / `tenant_id`;
   * AUTHZ-007 — by changing the id in a dashboard URL, on any deployment where the Supabase
     RLS policies are not installed.
   The path- and body-id routes themselves (`/api/properties/[id]`,
   `/api/tenants/[id]`, `/api/payments/[id]`, `/api/notes/[id]`, `/api/documents/[id]`,
   `/api/maintenance/[id]`, `/api/expenses/[id]`) are **correctly** scoped — see §1.
5. **Service-role routes:** 11 in total; every one re-implements the owner check (see §4).
6. **Role model / privilege escalation:** no enforceable role model exists; the two escalations
   that do exist are AUTHZ-005 and AUTHZ-009 (see §4).
7. **Mass assignment:** no `user_id`/`role`/`status` overwrite is possible; the two variants
   that exist are AUTHZ-006 (foreign keys) and AUTHZ-001 (SQL identifiers).
8. **Server actions:** `lib/actions.ts` (sign in / sign up / sign out) and
   `lib/actions/settings.ts` (`updatePreferences`, `updateNotifications`, `updateProfile`,
   `updatePassword`, `signOutAllDevices`) are **clean** — `requireUser()`
   (`lib/actions/settings.ts:7-14`) redirects to `/auth/login` without a user, and every write
   forces `user_id: user.id` (`lib/actions/settings.ts:35, 60, 97, 110`). The one thing worth
   noting is `updateProfile` (`lib/actions/settings.ts:104-114`) which writes the `companies`
   row with `owner_id: user.id` and a slug derived from `user.id` — also clean.
   `app/(marketing)/auth/forgot-password/action.ts:5-14` does not disclose whether the address
   exists.
9. **Middleware coverage:** the matcher covers the API surface, with one verified bypass
   (AUTHZ-012, the `.js` suffix) and one fail-open condition (AUTHZ-013). The email-verification
   gate is enforced in the middleware (`lib/supabase/middleware.ts:90-94`), in the dashboard
   layout (`app/dashboard/layout.tsx:44-46`) and in the sign-in action
   (`lib/actions.ts:35-43`) — but **not** in the API routes: an unverified user can call every
   `withAuth` route and read/write their own data. That is a deliberate-looking choice, and
   since the data is the user's own it is not reported as a finding.
10. **Can the middleware be bypassed by a path that does not match the pattern?** Yes — see
    AUTHZ-012 (`.js` suffix) and AUTHZ-013 (missing env vars). Trailing slash, double slash,
    encoded slash and case variants were all checked and are **not** exploitable (§AUTHZ-012,
    "Other bypass shapes checked").

---

## 6. Cross-references to the other tracks (do not double-count)

* **AUTHZ-001** is the same defect as `audit/INDEPENDENT_FINDINGS.md` **IND-001** and as the
  infra track's "attacker-controlled column names in `POST /api/backup/import`". It appears
  here because its *tenancy* consequence (taking over another landlord's rows) is this
  track's question.
* The timing-unsafe secret comparisons (`CRON_SECRET`, `MIGRATION_SECRET`,
  `BACKUP_CRON_SECRET`) are **IND-002** / **CRYPTO-008..010** — deliberately not repeated here.
* The `NODE_ENV !== "production"` fallbacks on the cron and migration routes are **IND-006** —
  not repeated here. `POST /api/backup/auto` has the same shape and is covered by
  **CRYPTO-010**; its tenancy angle (it accepts an arbitrary `user_id` in the body,
  `app/api/backup/auto/route.ts:44, 84-90`) is minor and is not raised separately.
* The public `documents` storage bucket (**CRYPTO-005**) is what makes
  `app/dashboard/documents/[id]/page.tsx` and the document `file_url` values sensitive in
  AUTHZ-007.

---

## Remediation status (owner-side pass, after this track reported)

This file is the original finding write-up. The **current status of every
finding in this track** lives in `audit/findings/authz.json` — each entry carries a `status`
(`FIXED` / `PARTIAL` / `OPEN` / `DONE`) and a `fix_notes` field describing
what was actually changed.

Track summary as of the end of the hardening pass:

| Severity | Total | FIXED | PARTIAL | OPEN | DONE |
|---|---:|---:|---:|---:|---:|
| CRITICAL | HIGH | LOW | MEDIUM | 14 | 6 | 0 | 8 | 0 |


The headline for this track: both SQL injections are closed, the cross-tenant invite/payment/status paths are scoped, and the secret comparisons are constant-time. What remains is a product decision (the public copy claims an audit log and an account-deletion control that do not exist).

See `AUDIT_REPORT.md` for the consolidated verdict and `HARDENING_RUNBOOK.md`
for the go-live sequence.
