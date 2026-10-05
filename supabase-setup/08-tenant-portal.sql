-- ============================================================
-- 08-tenant-portal.sql
-- Tenant portal access — link auth users to tenant records
-- ============================================================
--
-- A landlord creates a tenant record. If the tenant has an email, the
-- landlord can invite them to create an account; the resulting auth.users
-- row gets linked here by email. The portal queries ONLY through this
-- link, so a tenant can never see another tenant's data.

create table if not exists public.tenant_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  tenant_id uuid not null references public.tenants(id) on delete cascade unique,
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz
);

create index if not exists tenant_users_user_id_idx on public.tenant_users (user_id);
create index if not exists tenant_users_tenant_id_idx on public.tenant_users (tenant_id);

alter table public.tenant_users enable row level security;

-- The landlord (the tenant record's owner) can manage invites.
drop policy if exists "tenant_users_landlord_select" on public.tenant_users;
create policy "tenant_users_landlord_select" on public.tenant_users
  for select using (
    exists (
      select 1 from public.tenants t
      where t.id = tenant_users.tenant_id and t.user_id = auth.uid()
    )
  );

drop policy if exists "tenant_users_landlord_insert" on public.tenant_users;
create policy "tenant_users_landlord_insert" on public.tenant_users
  for insert with check (
    exists (
      select 1 from public.tenants t
      where t.id = tenant_users.tenant_id and t.user_id = auth.uid()
    )
  );

drop policy if exists "tenant_users_landlord_delete" on public.tenant_users;
create policy "tenant_users_landlord_delete" on public.tenant_users
  for delete using (
    exists (
      select 1 from public.tenants t
      where t.id = tenant_users.tenant_id and t.user_id = auth.uid()
    )
  );

-- A tenant can see their own link.
drop policy if exists "tenant_users_self_select" on public.tenant_users;
create policy "tenant_users_self_select" on public.tenant_users
  for select using (auth.uid() = user_id);
