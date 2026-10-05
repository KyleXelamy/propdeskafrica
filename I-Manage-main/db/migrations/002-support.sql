-- ============================================================
-- 002-support.sql
-- Notifications + property photos + tenant portal + mpesa
-- Idempotent. Plain Postgres (Neon-compatible).
-- ============================================================

-- 1) notifications table ---------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null,                          -- 'lease_expiring', 'document_expired', etc.
  title text not null,
  message text not null,
  severity text not null default 'info',       -- 'info' | 'warning' | 'critical' | 'success'
  link text,
  is_read boolean not null default false,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_id_created_at_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_id_is_read_idx
  on public.notifications (user_id, is_read);

-- 2) function: scan for expiring/expired leases ----------------------------
create or replace function public.run_lease_expiry_scan()
returns integer
language plpgsql
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
      ntype := 'lease_expired'; nsev := 'critical';
      ntitle := format('Lease expired: %s', coalesce(rec.full_name, trim(coalesce(rec.first_name,'') || ' ' || coalesce(rec.last_name,''))));
      nmsg := format('%s''s lease ended %s days ago at %s.',
                     coalesce(rec.full_name,'Tenant'), abs(rec.days_left), coalesce(rec.property_name,'the property'));
    elsif rec.days_left <= 7 then
      ntype := 'lease_expiring_critical'; nsev := 'critical';
      ntitle := format('Lease expiring soon: %s', coalesce(rec.full_name,'Tenant'));
      nmsg := format('%s''s lease at %s ends in %s day(s).', coalesce(rec.full_name,'Tenant'), coalesce(rec.property_name,'the property'), rec.days_left);
    elsif rec.days_left <= 30 then
      ntype := 'lease_expiring_warning'; nsev := 'warning';
      ntitle := format('Lease ending in %s days: %s', rec.days_left, coalesce(rec.full_name,'Tenant'));
      nmsg := format('Lease for %s at %s ends in %s days.', coalesce(rec.full_name,'Tenant'), coalesce(rec.property_name,'the property'), rec.days_left);
    else
      ntype := 'lease_expiring_upcoming'; nsev := 'info';
      ntitle := format('Lease renewing soon: %s', coalesce(rec.full_name,'Tenant'));
      nmsg := format('Lease for %s at %s ends in %s days.', coalesce(rec.full_name,'Tenant'), coalesce(rec.property_name,'the property'), rec.days_left);
    end if;
    nlink := case when rec.property_id is not null then format('/dashboard/properties/%s', rec.property_id) else '/dashboard/tenants' end;
    insert into public.notifications (user_id, type, title, message, severity, link, metadata)
    values (rec.user_id, ntype, ntitle, nmsg, nsev, nlink,
            jsonb_build_object('tenant_id', rec.tenant_id, 'property_id', rec.property_id,
                              'lease_end_date', rec.lease_end_date::text, 'days_left', rec.days_left));
    inserted := inserted + 1;
  end loop;
  return inserted;
end;
$$;

-- 3) function: generate due recurring expenses ----------------------------
create or replace function public.run_recurring_expenses()
returns integer
language plpgsql
as $$
declare
  rec record;
  inserted integer := 0;
  next_date date;
  exists_already uuid;
begin
  for rec in select * from public.expenses
    where is_recurring = true
      and recurring_frequency is not null
      and ((next_occurrence is not null and next_occurrence <= current_date)
           or (next_occurrence is null and expense_date::date <= current_date))
  loop
    loop
      if rec.recurring_frequency = 'monthly' then
        next_date := (coalesce(rec.next_occurrence, rec.expense_date::date) + interval '1 month')::date;
      elsif rec.recurring_frequency = 'quarterly' then
        next_date := (coalesce(rec.next_occurrence, rec.expense_date::date) + interval '3 months')::date;
      else
        next_date := (coalesce(rec.next_occurrence, rec.expense_date::date) + interval '1 year')::date;
      end if;
      exit when next_date > current_date;

      select id into exists_already from public.expenses
        where parent_recurring_id = rec.id and expense_date::date = next_date limit 1;
      if exists_already is null then
        insert into public.expenses (user_id, property_id, category, amount, description,
                                     expense_date, vendor, is_recurring, notes, parent_recurring_id)
        values (rec.user_id, rec.property_id, rec.category, rec.amount, rec.description,
                next_date, rec.vendor, false, rec.notes, rec.id);
        inserted := inserted + 1;
      end if;
    end loop;
    update public.expenses set next_occurrence =
      case
        when recurring_frequency = 'monthly' then (coalesce(next_occurrence, expense_date::date) + interval '1 month')::date
        when recurring_frequency = 'quarterly' then (coalesce(next_occurrence, expense_date::date) + interval '3 months')::date
        else (coalesce(next_occurrence, expense_date::date) + interval '1 year')::date
      end
    where id = rec.id;
  end loop;
  return inserted;
end;
$$;

-- 4) function: document expiry scan ---------------------------------------
create or replace function public.run_document_expiry_scan()
returns integer
language plpgsql
as $$
declare
  rec record;
  inserted integer := 0;
  days_left integer;
  ntype text; nsev text; ntitle text; nmsg text; nlink text;
begin
  for rec in
    select d.id, d.user_id, d.title, d.name, d.expiry_date, d.reminder_days_before,
           d.property_id, d.tenant_id, p.name as property_name
    from public.documents d
    left join public.properties p on p.id = d.property_id
    where d.expiry_date is not null
      and d.expiry_date::date <= (current_date + (d.reminder_days_before || ' days')::interval)::date
      and not exists (
        select 1 from public.notifications n
        where n.user_id = d.user_id
          and n.type like 'document_%'
          and n.metadata->>'document_id' = d.id::text
          and n.metadata->>'expiry_date' = d.expiry_date::text
      )
  loop
    days_left := (rec.expiry_date::date - current_date);
    if days_left < 0 then
      ntype := 'document_expired'; nsev := 'critical';
      ntitle := 'Document expired: ' || coalesce(rec.title, rec.name, 'Untitled');
      nmsg := format('%s expired %s day(s) ago.', coalesce(rec.title, rec.name, 'Untitled'), abs(days_left));
    elsif days_left <= 7 then
      ntype := 'document_expiring_critical'; nsev := 'critical';
      ntitle := 'Document expiring soon: ' || coalesce(rec.title, rec.name, 'Untitled');
      nmsg := format('%s expires in %s day(s).', coalesce(rec.title, rec.name, 'Untitled'), days_left);
    else
      ntype := 'document_expiring_upcoming'; nsev := 'warning';
      ntitle := 'Document expiring: ' || coalesce(rec.title, rec.name, 'Untitled');
      nmsg := format('%s expires on %s (%s day(s) away).', coalesce(rec.title, rec.name, 'Untitled'), rec.expiry_date::text, days_left);
    end if;
    nlink := case when rec.property_id is not null then format('/dashboard/properties/%s', rec.property_id) else '/dashboard/documents' end;
    insert into public.notifications (user_id, type, title, message, severity, link, metadata)
    values (rec.user_id, ntype, ntitle, nmsg, nsev, nlink,
            jsonb_build_object('document_id', rec.id, 'property_id', rec.property_id,
                              'expiry_date', rec.expiry_date::text, 'days_left', days_left));
    inserted := inserted + 1;
  end loop;
  return inserted;
end;
$$;

-- 5) function: maintenance reminder scan ----------------------------------
create or replace function public.run_maintenance_reminder_scan()
returns integer
language plpgsql
as $$
declare
  rec record;
  inserted integer := 0;
  days_until integer;
  ntype text; nsev text; ntitle text; nmsg text; nlink text;
begin
  for rec in
    select m.id, m.user_id, m.title, m.scheduled_date, m.status, m.priority,
           m.property_id, p.name as property_name
    from public.maintenance_requests m
    left join public.properties p on p.id = m.property_id
    where m.scheduled_date is not null
      and m.status not in ('completed', 'cancelled', 'closed')
      and m.scheduled_date::date <= (current_date + interval '3 days')
      and m.scheduled_date::date >= (current_date - interval '1 day')
      and not exists (
        select 1 from public.notifications n
        where n.user_id = m.user_id
          and n.type like 'maintenance_%'
          and n.metadata->>'maintenance_id' = m.id::text
          and n.metadata->>'scheduled_date' = m.scheduled_date::text
      )
  loop
    days_until := (rec.scheduled_date::date - current_date);
    if days_until < 0 then
      ntype := 'maintenance_overdue'; nsev := 'critical';
      ntitle := 'Maintenance overdue: ' || rec.title;
      nmsg := format('%s at %s is %s day(s) overdue.', rec.title, coalesce(rec.property_name, 'the property'), abs(days_until));
    elsif days_until = 0 then
      ntype := 'maintenance_due_today'; nsev := 'warning';
      ntitle := 'Maintenance due today: ' || rec.title;
      nmsg := format('%s at %s is scheduled for today.', rec.title, coalesce(rec.property_name, 'the property'));
    else
      ntype := 'maintenance_upcoming'; nsev := 'info';
      ntitle := format('Maintenance in %s day(s): %s', days_until, rec.title);
      nmsg := format('%s at %s is scheduled for %s.', rec.title, coalesce(rec.property_name, 'the property'), rec.scheduled_date::text);
    end if;
    nlink := format('/dashboard/maintenance/%s', rec.id);
    insert into public.notifications (user_id, type, title, message, severity, link, metadata)
    values (rec.user_id, ntype, ntitle, nmsg, nsev, nlink,
            jsonb_build_object('maintenance_id', rec.id, 'property_id', rec.property_id,
                              'scheduled_date', rec.scheduled_date::text, 'days_until', days_until, 'priority', rec.priority));
    inserted := inserted + 1;
  end loop;
  return inserted;
end;
$$;

-- 6) helper: mark all notifications read ---------------------------------
create or replace function public.mark_all_notifications_read(p_user uuid)
returns integer
language sql
as $$
  with updated as (
    update public.notifications set is_read = true
    where user_id = p_user and is_read = false
    returning 1
  )
  select count(*) from updated;
$$;

-- 7) property_photos ------------------------------------------------------
create table if not exists public.property_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  property_id uuid not null references public.properties(id) on delete cascade,
  file_url text not null,
  caption text,
  display_order integer not null default 0,
  is_cover boolean not null default false,
  uploaded_at timestamptz not null default now()
);
create index if not exists property_photos_property_id_idx
  on public.property_photos (property_id, display_order);
create index if not exists property_photos_user_id_idx on public.property_photos (user_id);

create or replace view public.property_cover_photo as
select distinct on (property_id) property_id, file_url as cover_url
from public.property_photos where is_cover = true
order by property_id, display_order asc;

-- 8) tenant_users (link an auth account to a tenant row) -----------------
create table if not exists public.tenant_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  tenant_id uuid not null references public.tenants(id) on delete cascade unique,
  invited_by uuid,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz
);
create index if not exists tenant_users_user_id_idx on public.tenant_users (user_id);
create index if not exists tenant_users_tenant_id_idx on public.tenant_users (tenant_id);

-- 9) mpesa_transactions ---------------------------------------------------
create table if not exists public.mpesa_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  payment_id uuid references public.rent_payments(id) on delete set null,
  phone text not null,
  amount integer not null check (amount > 0),
  merchant_request_id text,
  checkout_request_id text unique,
  status text not null default 'initiated'
    check (status in ('initiated','pending','completed','failed','cancelled')),
  result_code text,
  result_desc text,
  mpesa_receipt text,
  transaction_date text,
  raw_response jsonb,
  raw_callback jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists mpesa_transactions_user_id_idx on public.mpesa_transactions (user_id, created_at desc);
create index if not exists mpesa_transactions_tenant_id_idx on public.mpesa_transactions (tenant_id);
create index if not exists mpesa_transactions_payment_id_idx on public.mpesa_transactions (payment_id);
create index if not exists mpesa_transactions_status_idx on public.mpesa_transactions (status);

-- 10) helper: batched scan (called by /api/cron/run) ----------------------
-- Returns counts so the cron endpoint can show what got created.
create or replace function public.run_all_scans()
returns table(scan text, inserted integer)
language plpgsql
as $$
begin
  return query select 'lease'::text, public.run_lease_expiry_scan();
  return query select 'recurring'::text, public.run_recurring_expenses();
  return query select 'document'::text, public.run_document_expiry_scan();
  return query select 'maintenance'::text, public.run_maintenance_reminder_scan();
end;
$$;
