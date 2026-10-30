# Environment facts for the PropDesk Africa audit & hardening pass

Working copy: `/workspace/propdesk` (git baseline commit `467c500` = the code exactly as uploaded).

## Already set up for you — do NOT re-do these

- `node_modules/` **IS installed** (258 packages + `vite` 8.3.5 added as a devDependency).
  `npm test` and `npx tsc --noEmit` work out of the box.
- **Baseline `npx tsc --noEmit` = 54 pre-existing errors**, captured at
  `audit/baseline/tsc-baseline.log`. These are PRE-EXISTING and are not yours.
  Your obligation is **zero NEW errors**, not zero errors.
  Highest-error files in the baseline: `app/api/templates/[id]/preview/route.ts` (16),
  `app/dashboard/damages/page.tsx` (10), `app/api/stripe/webhook/route.ts` (6),
  `app/api/paybill/test-payment/route.ts` (5), `app/api/paybill/route.ts` (5),
  `components/dashboard-sidebar.tsx` (3).
- **Baseline `npm test` = 1 test file, 3 tests, all passing** (`lib/reconcile.test.ts`).
  The suite must still pass after your changes. Note: `vitest` 5.0.1 requires `vite`
  as a peer dependency and the original `package.json` did not declare it — that is
  one of the real findings; the `vite` devDependency has been added so the suite runs.
- `next.config.mjs` sets `typescript.ignoreBuildErrors: true`, so `npm run build`
  will NOT fail on type errors. You must check types explicitly with `npx tsc --noEmit`.

## Ground rules for every task

- Do NOT `git commit`. Leave changes in the working tree so the owner can diff them.
- Do NOT edit files under `audit/findings/` except the two files you own.
- Do NOT modify the baseline capture in `audit/baseline/`.
- Do NOT weaken existing assertions in `lib/reconcile.test.ts`.
- Use `git -C /workspace/propdesk diff 467c500 -- <path>` to see your own changes.

## Architecture cheat-sheet

| Concern | Implementation |
|---|---|
| Framework | Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4 |
| Auth | Supabase (`@supabase/ssr`), cookie session, server check = `supabase.auth.getUser()` |
| Primary DB | Neon Postgres via `@neondatabase/serverless` HTTP driver — **NO row-level security**; the app scopes every query by `user_id` in code (`lib/api/with-db-auth.ts`) |
| Fallback DB | `lib/supabase/server.ts` (Supabase Postgres) when `DATABASE_URL` is absent — a second security model |
| File storage | Supabase Storage (avatars, tenant documents, property photos) |
| Billing | Stripe (`lib/stripe.ts`), webhook at `app/api/stripe/webhook/route.ts` |
| Mobile money | Safaricom Daraja M-Pesa (`lib/mpesa/daraja.ts`), callbacks under `app/api/mpesa/**` |
| Validation | zod 3.25.76 |
| Tests | vitest 5.0.1 |
| Route helpers | `lib/api/with-db-auth.ts` (`withDbAuth`), `DbHttpError`, `jsonError` |
| ~90 API routes | `app/api/**/route.ts` |
| 85 pages | `app/(marketing)/**` + `app/dashboard/**` |

## Severity ladder (use it consistently)

- **CRITICAL** — unauthenticated access to tenant data, auth bypass, cross-tenant
  read/write, SQL injection, live credential exposure, unauthenticated payment
  mutation. Launch blocker.
- **HIGH** — authenticated IDOR / missing ownership check, privilege escalation,
  SSRF, unverified webhook with financial impact, upload bypass, mock data in a
  production path, PII leak.
- **MEDIUM** — missing defence-in-depth, missing security header, missing rate
  limit, verbose errors, weak secret comparison, config weakness.
- **LOW** — hardening nits, dead code, demo copy.
