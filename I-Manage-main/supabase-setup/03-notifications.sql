-- ============================================================
-- 03-notifications.sql
-- In-app notification feed + pg_cron lease-expiry automation
-- ============================================================
--
-- Idempotent. Run after 01-create-tables.sql and 02-add-missing-columns.sql.
-- Requires the Supabase pg_cron + pg_net extensions (enabled in the SQL Editor).

-- 1) notifications table -----------------------------------------------------

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,                          -- 'lease_expiring', 'lease_expired', 'payment_late', ...
  title text not null,
  message text not null,
  severity text not null default 'info',       -- 'info' | 'warning' | 'critical' | 'success'
  link text,                                   -- in-app deep-link (e.g. '/dashboard/properties/<id>')
  is_read boolean not null default false,
  metadata jsonb,                              -- free-form payload (tenant_id, property_id, days_left, ...)
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_created_at_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_id_is_read_idx
  on public.notifications (user_id, is_read);

-- RLS: a user can only see their own notifications.
alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select using (auth.uid() = user_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own" on public.notifications
  for delete using (auth.uid() = user_id);

-- The service role bypasses RLS so the cron job can insert freely.

-- 2) function: scan for expiring/expired leases and insert notifications ----
-- Idempotent: de-duplicates via a metadata->>'tenant_id' + type pair so we
-- only notify once per tenant per status per day.

create or replace function public.run_lease_expiry_scan()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer := 0;
  rec record;
  ntype text;
  nsev  text;
  ntitle text;
  nmsg  text;
  nlink text;
begin
  -- leases already expired but never notified today
  for rec in
    select t.id          as tenant_id,
           t.user_id     as user_id,
           t.full_name,
           t.first_name,
           t.last_name,
           t.lease_end_date,
           p.id          as property_id,
           p.name        as property_name,
           (t.lease_end_date::date - current_date) as days_left
    from public.tenants t
    left join public.properties p on p.id = t.property_id
    where t.status = 'active'
      and t.lease_end_date is not null
      and t.lease_end_date::date <= (current_date + interval '60 days')
      and not exists (
        select 1 from public.notifications n
        where n.user_id = t.user_id
          and n.type in ('lease_expired','lease_expiring_critical','lease_expiring_warning','lease_expiring_upcoming')
          and n.metadata->>'tenant_id' = t.id::text
          and n.metadata->>'lease_end_date' = t.lease_end_date::text
      )
  loop
    if rec.days_left < 0 then
      ntype  := 'lease_expired';
      nsev   := 'critical';
      ntitle := format('Lease expired: %s', coalesce(rec.full_name, trim(coalesce(rec.first_name,'') || ' ' || coalesce(rec.last_name,''))));
      nmsg   := format('%s''s lease ended %s days ago at %s.',
                       coalesce(rec.full_name,'Tenant'),
                       abs(rec.days_left),
                       coalesce(rec.property_name,'the property'));
    elsif rec.days_left <= 7 then
      ntype  := 'lease_expiring_critical';
      nsev   := 'critical';
      ntitle := format('Lease expiring soon: %s', coalesce(rec.full_name,'Tenant'));
      nmsg   := format('%s''s lease at %s ends in %s day(s).',
                       coalesce(rec.full_name,'Tenant'),
                       coalesce(rec.property_name,'the property'),
                       rec.days_left);
    elsif rec.days_left <= 30 then
      ntype  := 'lease_expiring_warning';
      nsev   := 'warning';
      ntitle := format('Lease ending in %s days: %s', rec.days_left, coalesce(rec.full_name,'Tenant'));
      nmsg   := format('Lease for %s at %s ends in %s days.',
                       coalesce(rec.full_name,'Tenant'),
                       coalesce(rec.property_name,'the property'),
                       rec.days_left);
    else
      ntype  := 'lease_expiring_upcoming';
      nsev   := 'info';
      ntitle := format('Lease renewing soon: %s', coalesce(rec.full_name,'Tenant'));
      nmsg   := format('Lease for %s at %s ends in %s days.',
                       coalesce(rec.full_name,'Tenant'),
                       coalesce(rec.property_name,'the property'),
                       rec.days_left);
    end if;

    nlink := case when rec.property_id is not null
                  then format('/dashboard/properties/%s', rec.property_id)
                  else '/dashboard/tenants' end;

    insert into public.notifications (user_id, type, title, message, severity, link, metadata)
    values (rec.user_id, ntype, ntitle, nmsg, nsev, nlink,
            jsonb_build_object(
              'tenant_id', rec.tenant_id,
              'property_id', rec.property_id,
              'lease_end_date', rec.lease_end_date::text,
              'days_left', rec.days_left
            ));
    inserted := inserted + 1;
  end loop;

  return inserted;
end;
$$;

-- 3) pg_cron scheduling ------------------------------------------------------
-- Runs every day at 07:00 UTC. Adjust timezone if your tenants are mostly
-- in one region (use TZ=Africa/Nairobi for EAT). pg_cron uses UTC by default.

create extension if not exists pg_cron;

-- Re-create the schedule idempotently. cron.schedule_job errors if the name
-- already exists in cron.job, so unschedule first if needed.
do $$
declare
  existing bigint;
begin
  select jobid into existing from cron.job where jobname = 'lease_expiry_scan_daily';
  if existing is not null then
    perform cron.unschedule(existing);
  end if;
end $$;

select cron.schedule(
  'lease_expiry_scan_daily',
  '0 7 * * *',
  $$ select public.run_lease_expiry_scan(); $$
);

-- 4) helper for users to mark all-read in one shot ---------------------------
create or replace function public.mark_all_notifications_read(p_user uuid)
returns integer
language sql
security invoker
as $$
  with updated as (
    update public.notifications
    set is_read = true
    where user_id = p_user and is_read = false
    returning 1
  )
  select count(*) from updated;
$$;

grant execute on function public.mark_all_notifications_read(uuid) to authenticated;
