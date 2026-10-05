-- ============================================================
-- 001-core.sql
-- Core I-Manage tables. Idempotent. Plain Postgres (Neon-compatible).
-- ============================================================
--
-- Important: I-Manage uses Supabase ONLY for Auth + Storage. The database
-- itself is hosted on Neon (Postgres). To keep migrations portable:
--   * No `auth.users` foreign keys — user_id is a plain uuid. Application
--     code is responsible for scoping every query by the authenticated
--     user's id (see lib/api/withAuth.ts).
--   * No pg_cron schedule calls. The cron functions (run_lease_expiry_scan,
--     run_recurring_expenses, etc.) are still installed here so they can be
--     invoked from a single endpoint (POST /api/cron/run) or an external
--     scheduler like Vercel Cron, GitHub Actions, etc.
--   * All tables have `updated_at timestamptz` for housekeeping.

-- Extensions ---------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- app_users: shadow table so the FK target for tenant_users etc. exists in
-- plain Postgres. The real user account lives in Supabase Auth; this row
-- is mirrored via webhook (see docs). All app-side foreign keys to "user"
-- point here so the schema is self-contained.
create table if not exists public.app_users (
  id uuid primary key,
  email text unique,
  full_name text,
  created_at timestamptz not null default now()
);

-- user_profiles ------------------------------------------------------------
create table if not exists public.user_profiles (
  user_id uuid primary key,
  full_name text,
  first_name text,
  last_name text,
  company_name text,
  phone text,
  address text,
  city text,
  county text,
  timezone text default 'Africa/Nairobi',
  currency text default 'KES',
  date_format text default 'DD/MM/YYYY',
  avatar_url text,
  notification_preferences jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- properties ---------------------------------------------------------------
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  address text,
  city text,
  county text,
  type text,
  bedrooms integer,
  bathrooms integer,
  rent_amount numeric(12,2),
  monthly_rent numeric(12,2),
  deposit_amount numeric(12,2),
  size_sqft integer,
  square_feet integer,
  status text default 'available',
  description text,
  amenities text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists properties_user_id_idx on public.properties (user_id);

-- tenants ------------------------------------------------------------------
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  full_name text,
  first_name text,
  last_name text,
  email text,
  phone text,
  national_id text,
  property_id uuid references public.properties(id) on delete set null,
  lease_start_date date,
  lease_end_date date,
  monthly_rent numeric(12,2),
  deposit_amount numeric(12,2),
  status text default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tenants_user_id_idx on public.tenants (user_id);
create index if not exists tenants_property_id_idx on public.tenants (property_id);

-- rent_payments ------------------------------------------------------------
create table if not exists public.rent_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tenant_id uuid references public.tenants(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  amount numeric(12,2) not null,
  due_date date not null,
  paid_date date,
  payment_method text,
  status text default 'pending',
  late_fee numeric(12,2) default 0,
  reference_number text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rent_payments_user_id_idx on public.rent_payments (user_id);
create index if not exists rent_payments_tenant_id_idx on public.rent_payments (tenant_id);
create index if not exists rent_payments_property_id_idx on public.rent_payments (property_id);

-- expenses -----------------------------------------------------------------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  property_id uuid references public.properties(id) on delete set null,
  category text not null,
  amount numeric(12,2) not null,
  description text,
  expense_date date not null default current_date,
  receipt_url text,
  vendor text,
  is_recurring boolean not null default false,
  recurring_frequency text check (recurring_frequency in ('monthly','quarterly','yearly')),
  next_occurrence date,
  parent_recurring_id uuid references public.expenses(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists expenses_user_id_idx on public.expenses (user_id);
create index if not exists expenses_property_id_idx on public.expenses (property_id);
create index if not exists expenses_is_recurring_idx on public.expenses (user_id, is_recurring);
create index if not exists expenses_next_occurrence_idx on public.expenses (next_occurrence)
  where is_recurring = true and next_occurrence is not null;

-- maintenance_requests -----------------------------------------------------
create table if not exists public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  property_id uuid references public.properties(id) on delete set null,
  tenant_id uuid references public.tenants(id) on delete set null,
  title text not null,
  description text,
  category text,
  priority text default 'medium',
  status text default 'open',
  contractor_name text,
  contractor_phone text,
  estimated_cost numeric(12,2),
  actual_cost numeric(12,2),
  scheduled_date date,
  completed_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists maintenance_user_id_idx on public.maintenance_requests (user_id);
create index if not exists maintenance_property_id_idx on public.maintenance_requests (property_id);
create index if not exists maintenance_tenant_id_idx on public.maintenance_requests (tenant_id);

-- notes --------------------------------------------------------------------
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text,
  content text,
  category text default 'general',
  property_id uuid references public.properties(id) on delete set null,
  tenant_id uuid references public.tenants(id) on delete set null,
  priority text default 'medium',
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notes_user_id_idx on public.notes (user_id);

-- documents ----------------------------------------------------------------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  type text not null,
  file_url text not null,
  file_size bigint,
  mime_type text,
  property_id uuid references public.properties(id) on delete set null,
  tenant_id uuid references public.tenants(id) on delete set null,
  category text,
  notes text,
  expiry_date date,
  reminder_days_before integer not null default 30
    check (reminder_days_before between 0 and 365),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists documents_user_id_idx on public.documents (user_id);
create index if not exists documents_expiry_date_idx on public.documents (expiry_date)
  where expiry_date is not null;
