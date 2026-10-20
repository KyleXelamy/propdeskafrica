-- Link receiving accounts to the properties they collect for.
create table if not exists public.paybill_properties (
  paybill_id uuid not null references public.paybills(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (paybill_id, property_id)
);

alter table public.paybill_properties enable row level security;
drop policy if exists "paybill_properties_owner" on public.paybill_properties;
create policy "paybill_properties_owner" on public.paybill_properties for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists paybill_properties_property_idx on public.paybill_properties(property_id);
