# Deliverable — M-Pesa payment path hardening (INFRA-004 / 005 / 006 / 007, AUTHZ-005)

**Task:** harden the Safaricom Daraja M-Pesa payment path in `/workspace/propdesk`.
**Author:** Coder (`harden-mpesa`) · **Date:** 2026-10-29
**Files owned:** `lib/mpesa/daraja.ts`, `app/api/mpesa/callback/route.ts`,
`app/api/mpesa/c2b/{confirmation,validation,register}/route.ts`, `app/api/mpesa/stkpush/route.ts`.

---

## 1. Status per finding

| Finding | Severity | Status | One-line reason |
|---|---|---|---|
| INFRA-004 | HIGH | **PARTIAL** | The C2B allowlist now fails closed and the shared secret is a second factor, but the middleware allowlist (`lib/supabase/middleware.ts` — not my file) still 401s `/api/mpesa/c2b/*`, so the legitimate callback cannot land yet. |
| INFRA-005 | HIGH | **FIXED** | The callback no longer reads a client-controllable header; the client IP comes only from a platform-overwritten header, and the shared secret is the real control. |
| INFRA-006 | HIGH | **FIXED** | The settled amount is compared with the amount charged and with the rent invoice before the invoice is marked paid; a mismatch leaves the invoice unpaid and is recorded. |
| INFRA-007 | HIGH | **PARTIAL** | The library can no longer be tricked into a mock payment (mock unreachable outside `NODE_ENV=development|test`, absent `MPESA_ENV` = production). The subscription entitlement is still granted by `app/api/subscription/checkout-status/route.ts` (not my file) from a client-triggered status query — that route must additionally reject a mocked result. |
| AUTHZ-005 | HIGH | **FIXED** | Daraja URL registration is now an operator-only action, gated by an explicit `MPESA_ADMIN_EMAILS` allowlist that fails closed when unset. |

### INFRA-004 — the C2B IP allowlist failed OPEN → **PARTIAL**

* **What was wrong:** `lib/mpesa/daraja.ts:268-283` returned `true` for *every* address when
  `MPESA_ALLOWED_CALLBACK_IPS` was unset and `MPESA_ENV !== "production"` (and `MPESA_ENV`
  defaulted to `"sandbox"`), so a deployment that forgot the variable accepted a forged
  Daraja confirmation from any IP — and the confirmation writes a `rent_payments` row with
  `status: 'paid'`.
* **What I changed**
  * `isFromSafaricom()` now returns **false** when the allowlist is unset or blank
    (fail closed). The "unset ⇒ allow everything" branch is deleted.
  * New `authenticateMpesaCallback(headers, { requireIpAllowlist, requireSecret })` in
    `lib/mpesa/daraja.ts` is used by both C2B routes with `requireIpAllowlist: true`:
    an unset allowlist ⇒ **reject** (`ip_allowlist_not_configured`), an address that is not
    allowlisted ⇒ reject, no platform-set client address ⇒ reject.
  * `MPESA_CALLBACK_SECRET` is accepted as a **second factor whenever it is configured**
    (constant-time compare via `crypto.timingSafeEqual` with a byte-length guard); a wrong
    or missing secret ⇒ reject.
  * The client address is taken from a platform-overwritten header only
    (`x-vercel-forwarded-for` → `cf-connecting-ip` → `x-real-ip`). `x-forwarded-for` is no
    longer read for any authorisation decision.
  * Response contract unchanged: `{ ResultCode: 1, ResultDesc: "Forbidden" }` / 403 for
    confirmation, `{ ResultCode: "C2B00012", ResultDesc: "Forbidden" }` / 403 for validation.
    The rejection *reason* is logged server-side only (no configuration recon to the caller).
* **What is left (PARTIAL):** `lib/supabase/middleware.ts:53-58` (`isExternalApi`) does not
  list the two C2B paths, so the middleware 401s every anonymous request to them. That file
  is owned by another agent, so I did not touch it. Until it is changed the C2B callbacks are
  unreachable — which is safe, but means the feature is still broken. Exact follow-up:

  ```ts
  // lib/supabase/middleware.ts — isExternalApi
  const isExternalApi =
    pathname === "/api/health" ||
    pathname === "/api/cron/run" ||
    pathname === "/api/mpesa/callback" ||
    pathname === "/api/mpesa/c2b/validation" ||   // ← add
    pathname === "/api/mpesa/c2b/confirmation"     // ← add
  ```

  This is now safe to do: the allowlist fails closed and the secret is enforced, so adding
  the paths cannot re-open the hole. **Order matters — apply the middleware change only
  after this deliverable is in place and `MPESA_ALLOWED_CALLBACK_IPS` is set.**

### INFRA-005 — the callback trusted the first `x-forwarded-for` hop → **FIXED**

* **What was wrong:** `app/api/mpesa/callback/route.ts:38-41` read
  `x-forwarded-for.split(",")[0]` — the value *the client chose* — and used it for the
  allowlist decision, so `X-Forwarded-For: <safaricom-ip>` passed the check.
* **What I changed**
  * `x-forwarded-for` is **never** used for an authorisation decision again. New
    `trustedClientIp()` reads only headers the hosting platform overwrites:
    `x-vercel-forwarded-for`, `cf-connecting-ip`, `x-real-ip`.
  * The callback now authenticates with `authenticateMpesaCallback(req.headers,
    { requireSecret: true, requireIpAllowlist: false })`:
    * `MPESA_CALLBACK_SECRET` unset ⇒ **503** `Callback secret is not configured`
      (unchanged from before);
    * wrong/missing secret ⇒ **403** `Rejected` (unchanged);
    * an allowlist that *is* configured must additionally be satisfied by the platform-set
      address ⇒ 403 otherwise.
  * Deliberate, documented consequence: when **no** allowlist is configured the STK
    callback is now decided by the shared secret alone. That is what INFRA-005 asks for
    ("keep `MPESA_CALLBACK_SECRET` as the mandatory primary control and treat the IP list
    as defence-in-depth only"), but it *is* a loosening versus the old behaviour in
    production (where an unset allowlist used to reject everything). The secret is
    mandatory and fails closed, so the control is still present.

### INFRA-006 — the invoice was marked paid without an amount check → **FIXED**

* **What was wrong:** `app/api/mpesa/callback/route.ts:69-103` selected
  `mpesa_transactions.amount` and then never used it — KES 1 settled a KES 50,000
  invoice. Upstream, `app/api/mpesa/stkpush/route.ts` accepted any positive `amount` from
  the client.
* **What I changed**
  * **The rule** (documented in `lib/mpesa/daraja.ts` next to the constant):
    a settled amount satisfies an invoice when it is **exactly** the invoice amount, or
    **within `MPESA_AMOUNT_TOLERANCE_KES` (= 1 KES)** of it. M-Pesa settles in whole
    shillings while `rent_payments.amount` is `numeric(12,2)`, so one shilling of rounding
    (50 000 vs 50 000.50) must not be a mismatch. Anything further apart is a mismatch.
  * `checkSettledAmount({ expected, settled, invoiceAmount })` (pure, unit-tested) decides.
  * In the callback the settled amount (`meta.Amount`) is compared with the amount we
    charged (`mpesa_transactions.amount`) **and** with the referenced rent invoice
    (`rent_payments.amount`, read with `.eq("id", …).eq("user_id", …)`). The invoice is only
    written to `status: 'paid'` when both hold.
  * **On a mismatch the invoice is NOT touched** (it stays unpaid) and the mismatch is
    recorded on the transaction: `mpesa_transactions.result_desc` =
    `"Amount mismatch: settled 1 KES, expected 50000 KES. Rent payment NOT marked paid —
    review required."`, plus a `console.error`. The callback still acks Daraja
    (`{ ResultCode: 0, ResultDesc: "Accepted" }`) so Safaricom does not retry and duplicate
    the transaction.
  * `mpesa_transactions.status` has a CHECK constraint
    (`status in ('initiated','pending','completed','failed','cancelled')` —
    `db/migrations/002-support.sql:299-300`), so the audit's suggested `'unmatched'` status
    cannot be stored without a migration (which is out of scope). The mismatch therefore
    lives in `result_desc` and in the deliberately-unpaid invoice.
  * **Push side (same finding):** `app/api/mpesa/stkpush/route.ts` now derives the amount
    owed server-side — the referenced `rent_payments` row when `payment_id` is supplied,
    otherwise the tenant's `monthly_rent` — and rejects a push whose amount does not match
    (400). A `payment_id` that is not the caller's is now 404 (it was an unchecked
    cross-tenant id, also flagged by AUTHZ-006).

### INFRA-007 — a paid subscription was granted for free → **PARTIAL**

* **What was wrong:** `lib/mpesa/daraja.ts:47` defaulted `MPESA_ENV` to `sandbox`, and
  `:143-151` / `:203-212` returned a *synthetic success* whenever
  `MPESA_SANDBOX_MOCK=1`. A production deployment with `MPESA_ENV` unset, or with the
  sandbox flag copied from a local `.env`, self-approved every payment.
* **What I changed (library)**
  * `MPESA_ENV`: **only** the exact value `sandbox` (trimmed, case-insensitive) selects the
    Daraja sandbox. Unset, blank, `"prod"`, `"staging"` ⇒ **production**. The sandbox is
    never the default.
  * The mock transport requires `MPESA_SANDBOX_MOCK === "1"` **and** a non-production
    runtime. `NODE_ENV !== "production"` alone is not enough (a self-hosted container that
    never sets `NODE_ENV` satisfies it), so the mock additionally requires
    `NODE_ENV === "development" | "test"` (`isMockEnvironment()`). This is *stricter* than
    the literal instruction and is deliberate — the instruction's intent is "impossible to
    reach by accident in production".
  * When the flag is set but the runtime does not allow it (`mockBlocked`), every transport
    call **throws** a clear error instead of silently switching mode, and
    `darajaConfigured()` returns **false** so the routes answer 503 "Payments are temporarily
    unavailable" rather than pretending a payment happened.
  * `stkPush`/`stkQuery`/`c2bRegister`/`c2bTransactionStatus` now tag a synthetic answer
    with `mocked: true`, so a caller can tell a fake success from a real one.
* **What is left (PARTIAL) — exact instructions for the route owner**
  `app/api/subscription/checkout-status/route.ts` (not my file) still promotes the
  subscription (`subscriptions.status = "active"`, `current_period_end = now + 30d`) purely
  from `stkQuery()`'s `ResultCode === "0"` — a **client-triggered** status query. It must
  add, before the `subscriptions` upsert:

  ```ts
  // A status query is not a payment. Refuse to grant an entitlement on a
  // synthetic (mock) answer, and on anything that did not come from Daraja.
  if ((result as any).mocked === true) {
    return errorResponse("Payment not confirmed", 402)
  }
  if (process.env.MPESA_ENV !== "production") {
    return errorResponse("Payments are not enabled in this environment", 503)
  }
  ```

  The same caveat applies to `app/api/mpesa/status/route.ts` (it flips
  `mpesa_transactions.status` to `completed` from a status query).
  With the library fix alone the free-subscription outcome is already closed in production
  (the mock transport is unreachable and `darajaConfigured()` is false ⇒ the checkout route
  502s and no `subscription_payments` row is created), but the route-level check above is
  still required so a *future* mock/edge case cannot grant an entitlement.

### AUTHZ-005 — any signed-in user could re-point the platform's Daraja URLs → **FIXED**

* **What was wrong:** `app/api/mpesa/c2b/register/route.ts:22-46` let any authenticated
  landlord call Daraja's "register URL" API with the **platform's** consumer key/secret
  and any `validation_url` / `confirmation_url`, so the attacker could take over the
  confirmation URL of the platform paybill.
* **How the app models roles:** it does **not**. `team_members.role`
  (`admin|manager|agent|accountant|viewer`, `app/api/company/route.ts:14`) is written but
  never read in any authorisation path (INFRA-025 — "the role is decorative"), there is no
  `is_admin` column on `user_profiles`, and no admin/operator concept anywhere in the code.
  I did not invent one.
* **What I changed:** the route is now an **operator action** gated by an explicit env
  allowlist, `MPESA_ADMIN_EMAILS` (comma-separated e-mails, case-insensitive):
  * `MPESA_ADMIN_EMAILS` unset/empty ⇒ **503** "Operator access is not configured" for
    everyone (fail closed — it never falls open);
  * the signed-in user's e-mail not on the list ⇒ **403** "Forbidden: only a platform
    operator may register Daraja URLs";
  * the session is still required (`withAuth`) and the cross-origin guard still applies.
  * Hardening while in there: `short_code` must be a numeric 6–10 digit Safaricom
    shortcode, and both URLs must be `https://` (Daraja requires HTTPS; an `http://`
    callback would carry payer MSISDN and legal name in the clear). Both are 400s.
  * The action is logged with the operator's identity: `console.info("[c2b] urls
    registered", { operator: email, userId, … })`.
* **The owner MUST set `MPESA_ADMIN_EMAILS`** — until then the route refuses everything:

  ```
  MPESA_ADMIN_EMAILS=ops@propdesk.africa,finance@propdesk.africa
  ```

  Use individual mailboxes, not a shared alias that a tenant could read.

---

## 2. Files changed (one line each)

| File | Change |
|---|---|
| `lib/mpesa/daraja.ts` | Fail-closed callback auth (`authenticateMpesaCallback`, `trustedClientIp`, `verifyCallbackSecret`, `allowedCallbackIps`), mock transport unreachable outside dev/test, absent `MPESA_ENV` = production, amount-verification helpers, operator allowlist helpers. |
| `app/api/mpesa/callback/route.ts` | Authenticates with the shared secret + platform-set IP (never `x-forwarded-for`); compares the settled amount with the charge and the invoice before marking the invoice paid; records mismatches. |
| `app/api/mpesa/c2b/confirmation/route.ts` | Replaces the fail-open IP check with `authenticateMpesaCallback({ requireIpAllowlist: true })` — an unset allowlist now rejects. |
| `app/api/mpesa/c2b/validation/route.ts` | Same fail-closed gate for the validation callback. |
| `app/api/mpesa/c2b/register/route.ts` | Operator-only (MPESA_ADMIN_EMAILS, fail closed), numeric shortcode, HTTPS-only callback URLs. |
| `app/api/mpesa/stkpush/route.ts` | Derives the amount owed server-side and rejects a mismatch; scopes `payment_id` to the caller and the tenant; uses `darajaPaymentsAvailable()` instead of the raw mock-flag check. |
| `lib/mpesa/daraja.security.test.ts` | **NEW** — 35 hermetic regression tests for INFRA-004/005/006/007 + AUTHZ-005 (library level). |
| `lib/mpesa/mpesa-routes.security.test.ts` | **NEW** — 12 hermetic regression tests for the route-level gates (callback, C2B confirmation/validation, register). |

No database schema change, no migration, no change to `audit/` except this file.

---

## 3. Commands run and their real output

### 3.1 `npx tsc --noEmit` — before / after

```
$ grep -c 'error TS' audit/baseline/tsc-baseline.log
54

$ npx tsc --noEmit 2>&1 | grep -c 'error TS'
52

$ grep -E "lib/mpesa|app/api/mpesa" /tmp/tsc-final.txt
(none)

$ diff <(grep 'error TS' audit/baseline/tsc-baseline.log | sort) \
       <(grep 'error TS' /tmp/tsc-final.txt | sort)
1,2d0
< app/(marketing)/templates/page.tsx(104,24): error TS2339: Property 'legalBasis' does not exist on type 'Template'.
< app/(marketing)/templates/page.tsx(106,91): error TS2339: Property 'legalBasis' does not exist on type 'Template'.
```

**54 pre-existing errors → 52 now.** The two removed errors are in
`app/(marketing)/templates/page.tsx` and were fixed by another agent working in parallel
(not by me). **Zero new errors, zero errors in any file I own.** The baseline log itself
was not modified.

> One intermediate run reported `app/api/mpesa/stkpush/route.ts(116,28): error TS2304:
> Cannot find name 'ctx'` — another agent was editing that file mid-write at that moment.
> The final run (above) is clean: 52 errors, none in the M-Pesa files. The other agent's
> change to that file was limited to the Daraja error message
> (`"Could not reach the M-Pesa gateway"`); the amount-verification and ownership checks
> described above are intact.

### 3.2 `npm test` — full suite

```
$ npm test

 RUN  v5.0.1 /workspace/propdesk

 Test Files  5 passed (5)
      Tests  130 passed (130)
   Start at  10:03:25
   Duration  2.79s (transform 52%, import 47%, collect 0%, tests 0%, setup 0%, env 0%)
```

Baseline for this task was "2 files / 30 tests passing" (other agents added more files in
parallel). **The suite passes: 5 files / 130 tests, 0 failures.**

My own two files:

```
$ npx vitest run lib/mpesa/daraja.security.test.ts
 Test Files  1 passed (1)
      Tests  35 passed (35)

$ npx vitest run lib/mpesa/mpesa-routes.security.test.ts
 Test Files  1 passed (1)
      Tests  12 passed (12)
```

Every test is hermetic: no network, no database, no Supabase. The environment is snapshotted
and restored around each case; the register-route test uses the mock transport
(`MPESA_SANDBOX_MOCK=1`, `NODE_ENV=test`) so no Daraja call is made.

> Note: during one run the suite failed with `Cannot find package 'next/server'` — a
> concurrent `npm install` (another agent upgrading `next` to 16.4.3) had `node_modules/next`
> half-written. The suite passes again once the install finished; the same command was re-run
> and is quoted above.

---

## 4. Public contract changes (please read)

These are behaviour changes to existing endpoints. They are required by the findings, but
they will change what the UI does:

1. **`POST /api/mpesa/stkpush`**
   * `400 "Amount mismatch: KES X does not match the amount due (KES Y)"` when the requested
     amount is not the amount owed (±1 KES).
   * `400 "No monthly rent to charge — set a monthly rent for this tenant, or send a
     payment_id"` when there is no invoice to compare against. A tenant with no
     `monthly_rent` can no longer push an arbitrary amount.
   * `400 "Payment does not belong to this tenant"` / `404 "Payment not found"` for a
     `payment_id` that is not the caller's.
   * `components/mpesa-pay-button.tsx` sends `defaultAmount = tenant.monthly_rent` and no
     `payment_id` — that still works as long as the tenant has a monthly rent. The amount
     input in the UI is now policed server-side.
2. **`POST /api/mpesa/c2b/register`**
   * `503` when `MPESA_ADMIN_EMAILS` is unset, `403` for a non-operator, `400` for a
     non-numeric short code or a non-HTTPS URL.
3. **C2B callbacks (`/api/mpesa/c2b/validation`, `/api/mpesa/c2b/confirmation`)**
   * `403` unless `MPESA_ALLOWED_CALLBACK_IPS` is configured **and** the request carries a
     platform-set client address that is on the list. The response body shape is unchanged.
4. **`POST /api/mpesa/callback`**
   * `503` when `MPESA_CALLBACK_SECRET` is unset (unchanged), `403` when the secret is wrong
     (unchanged). The IP allowlist is now defence in depth: with no allowlist configured the
     secret alone decides.
   * A settled amount that does not match the invoice leaves the rent invoice **unpaid**
     and records the mismatch in `mpesa_transactions.result_desc`; the browser polls
     `/api/mpesa/status`, which reports `status: "completed"` (the money did arrive) — the
     mismatch text is in `result_desc`. A follow-up in that (not-my-file) route would be to
     surface the mismatch instead of a plain "Payment received".

---

## 5. What the operator must configure (production)

| Variable | Required? | Effect |
|---|---|---|
| `MPESA_ENV` | yes, explicit | `"production"` for live. Unset/blank ⇒ production. Only `"sandbox"` selects the Daraja sandbox. |
| `MPESA_CONSUMER_KEY` / `_SECRET` / `MPESA_SHORTCODE` / `MPESA_PASSKEY` / `MPESA_CALLBACK_URL` | yes | Unchanged. |
| `MPESA_CALLBACK_SECRET` | yes | Shared secret for the STK callback (`x-mpesa-callback-secret` header). Without it the callback answers 503. |
| `MPESA_ALLOWED_CALLBACK_IPS` | yes for C2B | Safaricom callback IP ranges (CIDRs allowed). Without it the C2B callbacks are rejected. |
| `MPESA_ADMIN_EMAILS` | yes | Operators allowed to register Daraja URLs. Without it the route refuses everyone. |
| `MPESA_SANDBOX_MOCK` | **must be absent in production** | If it is set in a production runtime the payment path now fails loudly (`503`/error) instead of approving fake payments. |
| platform header | yes | The host must set `x-vercel-forwarded-for` (Vercel), `cf-connecting-ip` (Cloudflare) or `x-real-ip` (nginx). Without one, the C2B callbacks cannot be authenticated. |

**Operational warning — Safaricom does not send custom headers.** `MPESA_CALLBACK_SECRET`
is checked in the `x-mpesa-callback-secret` header. Daraja will not send it, so it must be
injected at the edge (a proxy/CDN rule that adds the header for `/api/mpesa/*`), or the
C2B flow must rely on the IP allowlist alone (which is what the C2B routes do when no
secret is configured). **Confirm this is wired up before going live, or the STK callback
will 403 every real settlement.**

---

## 6. "What an attacker tries next" — the payment path

1. **Replay a captured Daraja callback.** The callbacks carry no nonce, timestamp or
   signature, so a captured genuine callback can be replayed. The amount check limits the
   damage (it can only re-mark the *same* invoice paid — no new money is created), but
   `paid_date` is rewritten on every replay and the replay is not detected. **Fix:** sign
   the payload (HMAC over the raw body + a timestamp) and reject anything older than a few
   minutes; the shared-secret header alone does not bind the body to the request.
2. **Brute-force / leak `MPESA_CALLBACK_SECRET`.** The comparison is constant-time, but
   there is **no rate limit** on the callback endpoints (INFRA-012) and no lockout. A
   long, random secret plus an edge rate limit is the mitigation.
3. **Forge the C2B confirmation through the middleware.** Until
   `lib/supabase/middleware.ts` allows the C2B paths, the route is unreachable (401) — safe.
   The moment those paths are allowed, the allowlist + secret gate applies. If the operator
   sets the allowlist to `0.0.0.0/0` "to make it work", the C2B route is forgeable again —
   that is the single most likely misconfiguration.
4. **Re-point the Daraja URLs.** Fixed by `MPESA_ADMIN_EMAILS`, but the residual risk is the
   allowlist content: a shared mailbox, a contractor's address, or an address that a
   tenant can register themselves with (Supabase sign-up is open!) is enough to re-take the
   platform paybill. Keep the list to addresses the owner controls, and consider the audit's
   stronger suggestion — a server-side `MPESA_ADMIN_SECRET` header or a deploy script
   instead of an HTTP route.
5. **Ride the mock path.** `MPESA_SANDBOX_MOCK=1` in production now throws instead of
   returning a fake success, and `MPESA_ENV` unset no longer means "sandbox". The remaining
   hole is `app/api/subscription/checkout-status/route.ts` (not my file), which still turns
   a status query into an entitlement — it must check `mocked`/`MPESA_ENV` as documented
   above.
6. **Underpay.** The ±1 KES tolerance is the deliberate soft spot: a KES 49,999 payment
   settles a KES 50,000 invoice. That is the documented rounding rule; if partial payments
   must not settle an invoice, set `MPESA_AMOUNT_TOLERANCE_KES` to 0 in
   `lib/mpesa/daraja.ts` (single constant, one-line change).
7. **Cross-tenant `payment_id`.** `POST /api/mpesa/stkpush` used to accept any
   `payment_id` (AUTHZ-006). It is now scoped to the caller *and* the tenant.

---

## 7. Open items / not done here

| Item | Why | What is needed |
|---|---|---|
| C2B paths are not reachable | `lib/supabase/middleware.ts` is owned by another agent | Add `/api/mpesa/c2b/validation` and `/api/mpesa/c2b/confirmation` to `isExternalApi` — **after** this deliverable and after `MPESA_ALLOWED_CALLBACK_IPS` is set. |
| Subscription entitlement from a status query | `app/api/subscription/checkout-status/route.ts` is not my file | Reject `result.mocked === true` and require `MPESA_ENV === "production"` before the `subscriptions` upsert (snippet in §1, INFRA-007). |
| `mpesa_transactions.status` cannot hold `'unmatched'` | CHECK constraint in `db/migrations/002-support.sql:299-300`; migrations are out of scope | Either keep the mismatch in `result_desc` (current behaviour) or add a status value in a later migration. |
| Callback replay protection | Out of scope for the five findings | Sign the callback body (HMAC + timestamp) — see §6.1. |
| `x-forwarded-for` is still visible in the logs of the hosting platform | — | Not actionable in the app. |
| Rate limiting on the callbacks | INFRA-012, owned elsewhere | Add the callback endpoints to the shared rate limiter. |
