# Feature-completion findings

**Track:** `features` · **Findings:** 18 · **Machine-readable register:** `audit/findings/features.json`

The dedicated feature-audit track was lost to a runtime failure before it could
publish its report. This inventory was rebuilt from the code by the owner-side
pass and cross-checked against `audit/findings/leaks.json` and
`authz.json`. Every `DONE` item was implemented and type-checked in this pass;
every `OPEN` item names the exact file and what is missing.

**Severity here means user impact, not security severity.**

---

## Summary

| Severity | Count | Done | Partial | Open |
|---|---:|---:|---:|---:|
| HIGH | 9 | 8 | 0 | 1 |
| MEDIUM | 7 | 0 | 1 | 6 |
| LOW | 2 | 0 | 0 | 2 |
| **Total** | **18** | **8** | **1** | **9** |

The headline: **nine public endpoints and two dashboard features were
returning fabricated results.** Every visitor enquiry was being written to a
log and answered with a convincing success message. That is now fixed — each
endpoint persists to a real table and returns an honest `503` when the write
fails.

---

## DONE

### FEAT-001 — HIGH — Nine public write endpoints only logged the submission

**File:** `app/api/newsletter/route.ts` (and contact, pricing/lead,
enterprise/lead, feedback, support, customer-requests, damages, quotations)

```ts
console.info("Newsletter subscription", { email, name, source })
return NextResponse.json({ ok: true, message: "Check your inbox for a confirmation." })
```

Nothing was written. Five of the nine are public and unauthenticated, so this
was the normal path for every marketing enquiry the platform would ever
receive.

**Fixed.** Each endpoint persists to a real table and returns an honest 503
when the write fails — never a fabricated success. New schema in
`db/migrations/004-marketing-forms.sql`; a shared writer in
`lib/api/public-submissions.ts` that rejects unknown columns, binds every
value as a parameter and never logs PII; in-memory rate limiting in
`lib/api/rate-limit.ts`.

| Endpoint | Table |
|---|---|
| `/api/newsletter` | `newsletter_subscribers` |
| `/api/contact`, `/api/pricing/lead`, `/api/enterprise/lead` | `contact_submissions` (a `kind` column separates them) |
| `/api/feedback`, `/api/customer-requests` | `customer_requests` (+ `customer_request_votes`) |
| `/api/support` | `support_tickets` |
| `/api/damages` | `damages` (+ the additive `damages.unit_id`) |
| `/api/quotations` | `quotations` (+ the additive `quotations.contractor_ids`) |

### FEAT-002 — HIGH — `/api/damages` returned one hard-coded record to every landlord

**File:** `app/api/damages/route.ts`

```ts
const stub = [{ id: "DMG-204", title: "Cracked bathroom tile — shower floor", ... }]
return NextResponse.json({ count: stub.length, damages: stub })
```

**Fixed.** GET reads the caller's own rows scoped by `user_id`; POST verifies
the property and tenant belong to the caller and inserts a real row.

### FEAT-003 — HIGH — `/api/quotations` always returned an empty array

**File:** `app/api/quotations/route.ts`

```ts
void status; void propertyId; void limit
return NextResponse.json({ count: 0, quotations: [] })
```

Every write was discarded, and the endpoint answered "Quote request sent.
Contractors will respond within 48h."

**Fixed.** GET filters and returns the caller's quotes; POST verifies the
property, the maintenance record and every contractor contact belong to the
caller, then inserts a real row.

### FEAT-004 — HIGH — `/dashboard/quotations` was a static shell over an empty array

**File:** `app/dashboard/quotations/page.tsx`

```ts
const quotations: Array<{...}> = []   // a module-level constant, never fetched
```

The page rendered "No quotations yet" permanently, whatever the database
contained.

**Fixed.** The page reads the quotations table with the property and contact
joins, derives the three stat cards from the real rows, and converts the KES
minor-unit amounts for display. The "New quote request" button now links to
the maintenance page where quotes are actually created.

### FEAT-005 — HIGH — Two pages resolved to the same route

**Files:** `app/(marketing)/page.tsx` (deleted), `app/page.tsx` (kept)

Both existed and both rendered a marketing home page (230 and 228 lines). A
route group does not change the URL, so Next.js saw two pages resolving to `/`
— a build-time route conflict on the site's most important URL.

**Fixed.** The duplicate was removed and the more complete page was kept.

### FEAT-006 — MEDIUM — The public `/status` page never probed anything

**File:** `app/(marketing)/status/page.tsx`

A hard-coded `allOperational = true`. The status page was decorative: it would
have kept saying "All systems operational" while the database was down.

**Fixed.** It now uses the shared `lib/system-health.ts` probe — the same one
the dashboard settings screen and `/api/system/ping` use.

### FEAT-007 — MEDIUM — `/dashboard/settings/system` asserted "Everything is up to date"

**File:** `app/dashboard/settings/system/page.tsx`

A static card set with no database access.

**Fixed.** It calls `checkSystemHealth()` and renders the real app version,
schema version, database engine, health state and latency.

### FEAT-008 — HIGH — The public health probe leaked the raw database error

**File:** `app/api/system/ping/route.ts`

```ts
...(health.db_error ? { db_error: health.db_error } : {})
```

On an unauthenticated endpoint. A Postgres error can carry the database host,
database name, schema and table names.

**Fixed.** The public response now carries only `ok` / `db` / `latency_ms` /
`schema_version` / `timestamp`. The detail stays in the server log and on the
authenticated dashboard screen.

---

## PARTIAL

### FEAT-015 — MEDIUM — The security page promises an audit log and login rate limiting

**File:** `app/(marketing)/security/page.tsx`

**Partially addressed.** Rate limiting now exists on the public write
endpoints (`lib/api/rate-limit.ts`). An audit log does not — the
`reconciliation_audit` table records payment reconciliation events, not access
to sensitive data.

**Still needed.** Either build the audit log or amend the page. A published
security page is a commitment. See also CRYPTO-015.

---

## OPEN — needs a product decision, not a code change

### FEAT-009 — HIGH — Airtel Money is offered as a rent payment method with no Airtel integration

**File:** `app/(marketing)/pricing/page.tsx`

The payment-method copy lists Airtel Money. The only mobile-money integration
in the codebase is Safaricom Daraja (M-Pesa).

**Decision needed:** remove Airtel Money from the copy, or build the
integration. A tenant who picks Airtel Money cannot pay. Low effort either
way.

### FEAT-010 — HIGH — Fabricated customer case studies with attributable quotes

**File:** `lib/content/marketing.ts`

Named customers with specific quotes and metrics, presented as real case
studies.

**Decision needed:** replace with anonymised or clearly-labelled illustrative
examples, or remove them. Publishing invented customer quotes is a legal and
reputational exposure — and the privacy page claims data the platform does
not have.

### FEAT-011 — HIGH — The privacy policy and help centre promise an account-deletion control that does not exist

**File:** `app/(marketing)/legal/privacy/page.tsx`

The policy describes a data-deletion right. There is no `DELETE /api/account`
route and no deletion path in `lib/actions.ts`.

**The work is clear:** add a `DELETE /api/account` route that removes the
user's rows across every table, and anonymises what must be retained for
accounting. Note that `c2b_transactions` has **no foreign key to `tenants`** —
so a tenant delete today would silently leave the payer's phone number and
name behind.

**Decision needed:** what must be retained for accounting, and for how long.

### FEAT-012 — MEDIUM — The dashboard reads sensitive tenant columns straight from the browser

**File:** `app/dashboard/tenants/page.tsx` (and seven other pages)

The page queries the tenants table from the client and selects `national_id`,
`phone` and free-text notes.

**Why it is blocked rather than merely open:** any column-level encryption has
to move these reads behind the server first, otherwise the ciphertext is what
arrives in the browser. The exact list of pages is in
`audit/deliverable-encryption-core.md` §5.0 and in `HARDENING_RUNBOOK.md` §4.2.
This is **PHASE 0** of the encryption rollout.

### FEAT-013 — MEDIUM — Dead links in the public navigation

**File:** `app/(marketing)/`

Links pointing at `#` or at pages that do not exist — a Discord invite, a
forum, office hours, press assets.

**Fix:** remove the dead entries or point them at real destinations.

### FEAT-014 — MEDIUM — Fabricated download counts, vote counts, changelog releases and status incidents

**File:** `lib/content/marketing.ts`

Hard-coded template download counts, roadmap vote counts, a changelog of
releases that were never shipped, and status-page incidents.

Low security impact, real credibility impact — and it is the kind of thing a
first paying customer notices.

**Decision needed:** either zero the counters until there is real traffic, or
source them from real data.

### FEAT-016 — MEDIUM — The public copy claims row-level security and three data-residency regions

**File:** `app/(marketing)/legal/privacy/page.tsx`

The primary database is Neon Postgres with **no row-level security** — tenancy
is enforced in application code — and there is no region pinning.

**Decision needed:** correct the copy to describe what the platform actually
does, or implement what it claims. The application-level tenancy model is
defensible; saying it is RLS is not. See also CRYPTO-016 and CRYPTO-020.

### FEAT-017 — LOW — Sample documents are published as public binaries and are stale

**File:** `public/templates/`

Pre-generated `.docx` files that no longer match `lib/templates/templates.ts`.
A user downloads a document that is not the one the product produces today.

**Fix:** regenerate them at build time (the `prebuild-templates` script already
exists) and stop committing the binaries.

### FEAT-018 — LOW — Placeholder analytics claims and an unused analytics dependency

**File:** `components/`

`@vercel/analytics` is a dependency; the numbers are hard-coded.

**Fix:** wire up real analytics or remove the claim.
