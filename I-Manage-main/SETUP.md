# I-Manage — Setup & Run Guide

## 1. Supabase setup (one-time)

1. Create a project at https://supabase.com/dashboard
2. Open **SQL Editor → New query**
3. Paste the contents of `supabase-setup/01-create-tables.sql` and click **Run**
   - Idempotent — safe to re-run.
   - Already deployed with the old schema? Run `supabase-setup/02-add-missing-columns.sql` instead to add the new columns, RLS policies, triggers and the `documents` Storage bucket.
4. In **Storage**, confirm the `documents` bucket was created (it should be — the SQL does it). If not, create it manually as a *public* bucket.
5. In **Authentication → URL Configuration**, add `http://localhost:3000` to *Site URL* and `http://localhost:3000/auth/callback` to *Redirect URLs*.

## 2. Local environment

```bash
cp .env.example .env.local
```

Fill in:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

(You can find both in **Supabase → Project Settings → API**.)

## 3. Install + run

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## 4. Access control at a glance

The whole app is gated by **one** piece of code — `lib/supabase/middleware.ts` — plus a layout-level check in `app/dashboard/layout.tsx`. Rules enforced:

| Path | Anonymous | Signed in, unverified | Signed in, verified |
| --- | --- | --- | --- |
| `/`, `/auth/**` | allowed | allowed | allowed (auto-bounced from `/auth/login` and `/auth/sign-up` to `/dashboard`) |
| `/dashboard/**` | 307 → `/auth/login?next=…` | 307 → `/auth/verify-email` | allowed |
| `/api/**` (except `/api/health`) | 401 JSON | 401 JSON | allowed |
| `/api/health` | 200 JSON (liveness probe) | 200 JSON | 200 JSON |

Every `/api/**` route is wrapped in `withAuth()` (see `lib/api/index.ts`) which:
1. Validates the session with `supabase.auth.getUser()` (server round-trip, not the cookie-decode shortcut).
2. Scopes every DB read/write by `user_id` to enforce tenant isolation.
3. Returns a uniform `{ error, data }` envelope.

## 5. API surface

All routes are under `/api/` and require auth unless noted.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Liveness probe (no auth) |
| GET | `/api/dashboard` | Top-line stats for the home page |
| GET/POST | `/api/properties[/{id}]` | Properties CRUD |
| GET/POST | `/api/tenants[/{id}]` | Tenants CRUD |
| GET/POST | `/api/payments[/{id}]` | Rent payments CRUD |
| GET/POST | `/api/expenses[/{id}]` | Expenses CRUD |
| GET/POST | `/api/maintenance[/{id}]` | Maintenance requests CRUD |
| GET/POST | `/api/notes[/{id}]` | Notes CRUD |
| GET/POST | `/api/documents[/{id}]` | Documents CRUD |
| POST | `/api/documents/upload` | Multipart upload to Supabase Storage (`documents` bucket) |
| GET | `/api/reports?month=YYYY-MM` | Aggregated financial + property metrics |
| GET/PUT | `/api/profile` | Current user profile |

All endpoints accept these query params where filtering makes sense:
`property_id`, `tenant_id`, `status`, `type`, `month=YYYY-MM`, `year=YYYY`.

## 6. File storage

The `documents` bucket is public-read but each user can only read/write their own
folder. Files are uploaded via `POST /api/documents/upload` (multipart form-data
with a `file` field), which returns the public URL. The client then registers the
row in `documents` via `POST /api/documents`. The old "placeholder" URL hack is gone.

## 7. Database schema

All tables have RLS enabled with policies that scope reads/writes to the row's
`user_id`. Triggers keep `updated_at` honest, and a `handle_new_user()` trigger
auto-creates a row in `public.user_profiles` whenever a new auth user signs up.

`01-create-tables.sql` is the source of truth. `02-add-missing-columns.sql` is
just an additive migration for projects that were deployed with the original
schema and now need the new columns, policies, and the `documents` Storage bucket.

## 8. Building for production

```bash
npm run build
npm start
```

`next.config.mjs` keeps `ignoreBuildErrors: true` because a couple of UI files
have minor typing warnings (mostly about implicit `any` from Supabase's
untyped responses). The build succeeds and the runtime is unaffected.
