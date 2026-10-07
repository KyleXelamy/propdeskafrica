-- Idempotent repair for the deployed Supabase schema.
-- Safe to run after the numbered setup files; it does not delete data.

create extension if not exists "pgcrypto";

alter table public.properties
  add column if not exists size_sqft integer,
  add column if not exists monthly_rent numeric(12,2),
  add column if not exists deposit_amount numeric(12,2),
  add column if not exists amenities text[] default '{}';

alter table public.tenants
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists notes text,
  add column if not exists monthly_rent numeric(12,2);

alter table public.rent_payments
  add column if not exists due_date date,
  add column if not exists paid_date date,
  add column if not exists late_fee numeric(12,2) default 0,
  add column if not exists reference_number text,
  add column if not exists notes text;

alter table public.expenses
  add column if not exists vendor text,
  add column if not exists is_recurring boolean default false,
  add column if not exists recurring_frequency text,
  add column if not exists notes text;

alter table public.maintenance_requests
  add column if not exists notes text,
  add column if not exists category text not null default 'general';

alter table public.documents add column if not exists notes text;

alter table public.notes
  add column if not exists is_pinned boolean default false,
  add column if not exists priority text default 'normal',
  add column if not exists title text;

alter table public.user_profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists notification_preferences jsonb;

alter table public.rent_payments drop constraint if exists rent_payments_status_check;
alter table public.rent_payments add constraint rent_payments_status_check
  check (status in ('pending','paid','completed','late','partial','failed','cancelled'));

create index if not exists idx_properties_user_id on public.properties(user_id);
create index if not exists idx_tenants_user_id on public.tenants(user_id);
create index if not exists idx_rent_payments_user_id on public.rent_payments(user_id);
create index if not exists idx_expenses_user_id on public.expenses(user_id);
create index if not exists idx_maintenance_requests_user_id on public.maintenance_requests(user_id);
create index if not exists idx_documents_user_id on public.documents(user_id);
create index if not exists idx_notes_user_id on public.notes(user_id);
create index if not exists idx_user_profiles_user_id on public.user_profiles(user_id);

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['properties','tenants','maintenance_requests','notes','user_profiles'] loop
    execute format('drop trigger if exists update_%I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger update_%I_updated_at before update on public.%I for each row execute function public.update_updated_at_column()', table_name, table_name);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
