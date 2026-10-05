-- ============================================================
-- 10-holy-grail.sql
-- Landlord/agent control room: paybills, quotations, damages,
-- contacts, companies, managed_landlords, team_members,
-- reconciliation_rules, c2b_transactions, plus properties
-- lat/lng for the map view.
-- ============================================================

-- ------------------------------------------------------------
-- properties: add lat/lng for the map view (backfill optional)
-- ------------------------------------------------------------
alter table public.properties
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists geocoded_at timestamptz,
  add column if not exists landlord_id uuid; -- agency-mode link to managed_landlords

create index if not exists properties_latlng_idx
  on public.properties (latitude, longitude)
  where latitude is not null and longitude is not null;

create index if not exists properties_landlord_idx
  on public.properties (landlord_id)
  where landlord_id is not null;

-- ------------------------------------------------------------
-- paybills: one per Safaricom account number per workspace
-- ------------------------------------------------------------
create table if not exists public.paybills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid, -- soft FK added below once companies exists
  label text not null,
  number text not null,
  type text not null default 'paybill' check (type in ('paybill', 'till')),
  c2b_validation_url text,
  c2b_confirmation_url text,
  active boolean not null default true,
  matched_count integer not null default 0,
  unmatched_count integer not null default 0,
  last_payment_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, number, type)
);

create index if not exists paybills_user_idx on public.paybills (user_id);
create index if not exists paybills_company_idx on public.paybills (company_id);

alter table public.paybills enable row level security;

drop policy if exists "paybills_select_own" on public.paybills;
create policy "paybills_select_own" on public.paybills
  for select using (auth.uid() = user_id);

drop policy if exists "paybills_insert_own" on public.paybills;
create policy "paybills_insert_own" on public.paybills
  for insert with check (auth.uid() = user_id);

drop policy if exists "paybills_update_own" on public.paybills;
create policy "paybills_update_own" on public.paybills
  for update using (auth.uid() = user_id);

drop policy if exists "paybills_delete_own" on public.paybills;
create policy "paybills_delete_own" on public.paybills
  for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- c2b_transactions: every payment that comes in via paybill/till
-- ------------------------------------------------------------
create table if not exists public.c2b_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  paybill_id uuid references public.paybills(id) on delete set null,
  -- Raw fields from Daraja C2B callback
  transaction_type text,
  trans_id text unique,           -- Safaricom's internal id
  trans_time text,                -- YYYYMMDDHHmmss
  trans_amount numeric(12,2) not null,
  business_short_code text,
  bill_ref_number text,           -- tenant account reference
  invoice_number text,
  org_account_balance text,
  third_party_trans_id text,
  msisdn text,                    -- customer phone
  first_name text,
  middle_name text,
  last_name text,
  -- Matching
  matched_tenant_id uuid references public.tenants(id) on delete set null,
  matched_payment_id uuid references public.rent_payments(id) on delete set null,
  match_method text check (match_method in ('phone', 'account_ref', 'amount_property', 'amount_tenant', 'manual', 'unmatched')),
  match_confidence numeric(4,3), -- 0.000–1.000
  match_status text not null default 'pending' check (match_status in ('pending','matched','unmatched','manual')),
  raw jsonb,
  created_at timestamptz not null default now()
);

create index if not exists c2b_user_idx on public.c2b_transactions (user_id, created_at desc);
create index if not exists c2b_paybill_idx on public.c2b_transactions (paybill_id);
create index if not exists c2b_match_status_idx on public.c2b_transactions (match_status);
create index if not exists c2b_bill_ref_idx on public.c2b_transactions (bill_ref_number);
create index if not exists c2b_phone_idx on public.c2b_transactions (msisdn);

alter table public.c2b_transactions enable row level security;

drop policy if exists "c2b_select_own" on public.c2b_transactions;
create policy "c2b_select_own" on public.c2b_transactions
  for select using (auth.uid() = user_id);

drop policy if exists "c2b_insert_service" on public.c2b_transactions;
-- Inserts are made by the public C2B callback (service role) so no user policy needed.

drop policy if exists "c2b_update_own" on public.c2b_transactions;
create policy "c2b_update_own" on public.c2b_transactions
  for update using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- companies: agency / enterprise / family office workspaces
-- ------------------------------------------------------------
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text unique,
  type text not null default 'agency' check (type in ('agency', 'enterprise', 'family_office', 'individual')),
  address text,
  phone text,
  website text,
  logo_url text,
  created_at timestamptz not null default now()
);

create index if not exists companies_owner_idx on public.companies (owner_id);

alter table public.companies enable row level security;

drop policy if exists "companies_select_own" on public.companies;
create policy "companies_select_own" on public.companies
  for select using (auth.uid() = owner_id);

drop policy if exists "companies_modify_own" on public.companies;
create policy "companies_modify_own" on public.companies
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Now add the deferred FK
alter table public.paybills
  add constraint if not exists paybills_company_fk
  foreign key (company_id) references public.companies(id) on delete set null;

-- ------------------------------------------------------------
-- managed_landlords: each landlord under an agency's management
-- ------------------------------------------------------------
create table if not exists public.managed_landlords (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null, -- optional linked account
  name text not null,
  slug text not null,
  units integer not null default 0,
  contact_email text,
  contact_phone text,
  manager text,
  revenue_share numeric(5,2) default 0 check (revenue_share >= 0 and revenue_share <= 100),
  notes text,
  status text not null default 'active' check (status in ('active', 'paused', 'offboarded')),
  onboarded_at timestamptz not null default now(),
  unique (company_id, slug)
);

create index if not exists managed_landlords_company_idx on public.managed_landlords (company_id);
create index if not exists managed_landlords_user_idx on public.managed_landlords (user_id);

alter table public.managed_landlords enable row level security;

drop policy if exists "managed_landlords_select_company" on public.managed_landlords;
create policy "managed_landlords_select_company" on public.managed_landlords
  for select using (
    exists (select 1 from public.companies c where c.id = company_id and c.owner_id = auth.uid())
    or user_id = auth.uid()
  );

drop policy if exists "managed_landlords_modify_company" on public.managed_landlords;
create policy "managed_landlords_modify_company" on public.managed_landlords
  for all using (
    exists (select 1 from public.companies c where c.id = company_id and c.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.companies c where c.id = company_id and c.owner_id = auth.uid())
  );

-- Now wire properties.landlord_id
alter table public.properties
  add constraint if not exists properties_landlord_fk
  foreign key (landlord_id) references public.managed_landlords(id) on delete set null;

-- ------------------------------------------------------------
-- team_members: agency staff
-- ------------------------------------------------------------
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  role text not null default 'agent' check (role in ('admin', 'manager', 'agent', 'accountant', 'viewer')),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (company_id, email)
);

create index if not exists team_members_company_idx on public.team_members (company_id);

alter table public.team_members enable row level security;

drop policy if exists "team_members_select_company" on public.team_members;
create policy "team_members_select_company" on public.team_members
  for select using (
    exists (select 1 from public.companies c where c.id = company_id and c.owner_id = auth.uid())
    or user_id = auth.uid()
  );

drop policy if exists "team_members_modify_company" on public.team_members;
create policy "team_members_modify_company" on public.team_members
  for all using (
    exists (select 1 from public.companies c where c.id = company_id and c.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.companies c where c.id = company_id and c.owner_id = auth.uid())
  );

-- ------------------------------------------------------------
-- quotations: contractor quote workflow
-- ------------------------------------------------------------
create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  maintenance_id uuid references public.maintenance_requests(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'requested', 'pending', 'approved', 'rejected', 'paid', 'expired')),
  amount integer, -- in minor units (KES cents) — null until finalised
  notes text,
  requested_at timestamptz,
  responded_at timestamptz,
  approved_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quotations_user_idx on public.quotations (user_id, created_at desc);
create index if not exists quotations_property_idx on public.quotations (property_id);
create index if not exists quotations_status_idx on public.quotations (status);

alter table public.quotations enable row level security;

drop policy if exists "quotations_select_own" on public.quotations;
create policy "quotations_select_own" on public.quotations
  for select using (auth.uid() = user_id);

drop policy if exists "quotations_modify_own" on public.quotations;
create policy "quotations_modify_own" on public.quotations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- damages: photo-documented damage tracking
-- ------------------------------------------------------------
create table if not exists public.damages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete set null,
  maintenance_id uuid references public.maintenance_requests(id) on delete set null,
  title text not null,
  description text,
  location text,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high')),
  status text not null default 'reported' check (status in ('reported', 'in_repair', 'resolved', 'deposit_deduction', 'written_off')),
  cost integer,
  estimated_cost integer,
  photos text[] not null default '{}',
  inspection_id uuid,
  reported_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists damages_user_idx on public.damages (user_id, reported_at desc);
create index if not exists damages_property_idx on public.damages (property_id);
create index if not exists damages_tenant_idx on public.damages (tenant_id);
create index if not exists damages_status_idx on public.damages (status);

alter table public.damages enable row level security;

drop policy if exists "damages_select_own" on public.damages;
create policy "damages_select_own" on public.damages
  for select using (auth.uid() = user_id);

drop policy if exists "damages_modify_own" on public.damages;
create policy "damages_modify_own" on public.damages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- contacts: the unified rolodex
-- ------------------------------------------------------------
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  role text not null default 'other' check (role in ('tenant', 'contractor', 'owner', 'agent', 'accountant', 'other')),
  email text,
  phone text,
  company text,
  notes text,
  properties text[] not null default '{}',
  tags text[] not null default '{}',
  last_contact_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contacts_user_idx on public.contacts (user_id);
create index if not exists contacts_role_idx on public.contacts (user_id, role);
create index if not exists contacts_name_trgm on public.contacts using gin (name gin_trgm_ops);

alter table public.contacts enable row level security;

drop policy if exists "contacts_select_own" on public.contacts;
create policy "contacts_select_own" on public.contacts
  for select using (auth.uid() = user_id);

drop policy if exists "contacts_modify_own" on public.contacts;
create policy "contacts_modify_own" on public.contacts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- reconciliation_rules: per-tenant auto-match rules
-- ------------------------------------------------------------
create table if not exists public.reconciliation_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  paybill_id uuid references public.paybills(id) on delete cascade,
  name text not null,
  match_by text not null check (match_by in ('phone', 'account_ref', 'amount_property', 'amount_tenant', 'closest_amount')),
  priority integer not null default 0, -- higher = tried first
  active boolean not null default true,
  config jsonb not null default '{}'::jsonb, -- per-rule knobs (tolerance, etc.)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reconciliation_rules_user_idx on public.reconciliation_rules (user_id, priority desc);
create index if not exists reconciliation_rules_paybill_idx on public.reconciliation_rules (paybill_id);

alter table public.reconciliation_rules enable row level security;

drop policy if exists "reconciliation_rules_select_own" on public.reconciliation_rules;
create policy "reconciliation_rules_select_own" on public.reconciliation_rules
  for select using (auth.uid() = user_id);

drop policy if exists "reconciliation_rules_modify_own" on public.reconciliation_rules;
create policy "reconciliation_rules_modify_own" on public.reconciliation_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- reconciliation_audit: every match decision is logged
-- ------------------------------------------------------------
create table if not exists public.reconciliation_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  c2b_transaction_id uuid not null references public.c2b_transactions(id) on delete cascade,
  rule_id uuid references public.reconciliation_rules(id) on delete set null,
  decision text not null check (decision in ('matched', 'unmatched', 'manual', 'rejected')),
  matched_tenant_id uuid references public.tenants(id) on delete set null,
  matched_payment_id uuid references public.rent_payments(id) on delete set null,
  confidence numeric(4,3),
  notes text,
  decided_at timestamptz not null default now()
);

create index if not exists reconciliation_audit_user_idx on public.reconciliation_audit (user_id, decided_at desc);

alter table public.reconciliation_audit enable row level security;

drop policy if exists "reconciliation_audit_select_own" on public.reconciliation_audit;
create policy "reconciliation_audit_select_own" on public.reconciliation_audit
  for select using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- helpful views
-- ------------------------------------------------------------
create or replace view public.v_unmatched_transactions as
  select
    c.id, c.user_id, c.paybill_id, c.trans_id, c.trans_time, c.trans_amount,
    c.msisdn, c.bill_ref_number, c.first_name, c.last_name, c.created_at,
    p.label as paybill_label, p.number as paybill_number
  from public.c2b_transactions c
  left join public.paybills p on p.id = c.paybill_id
  where c.match_status in ('pending', 'unmatched');

create or replace view public.v_portfolio_yield as
  select
    p.id as property_id, p.user_id, p.name as property_name, p.city, p.county,
    coalesce(sum(rp.amount) filter (where rp.status = 'paid'), 0)::numeric as collected,
    coalesce(sum(e.amount), 0)::numeric as expenses
  from public.properties p
  left join public.rent_payments rp on rp.property_id = p.id
    and rp.paid_date >= date_trunc('month', now())
  left join public.expenses e on e.property_id = p.id
    and e.receipt_date >= date_trunc('month', now())
  group by p.id, p.user_id, p.name, p.city, p.county;

-- ------------------------------------------------------------
-- updated_at trigger for new tables
-- ------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['paybills', 'quotations', 'damages', 'contacts', 'reconciliation_rules'] loop
    execute format('drop trigger if exists touch_updated_at on public.%I', t);
    execute format('create trigger touch_updated_at before update on public.%I
      for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;
