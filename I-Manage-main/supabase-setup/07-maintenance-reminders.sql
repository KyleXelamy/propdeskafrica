-- ============================================================
-- 07-maintenance-reminders.sql
-- Auto-notify on upcoming maintenance due dates
-- ============================================================

-- 1) function: notify on upcoming maintenance -------------------------------

create or replace function public.run_maintenance_reminder_scan()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  inserted integer := 0;
  days_until integer;
  ntype text;
  sev text;
  ntitle text;
  nmsg text;
  nlink text;
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
      ntype := 'maintenance_overdue';
      sev := 'critical';
      ntitle := 'Maintenance overdue: ' || rec.title;
      nmsg := format('%s at %s is %s day(s) overdue.',
                     rec.title,
                     coalesce(rec.property_name, 'the property'),
                     abs(days_until));
    elsif days_until = 0 then
      ntype := 'maintenance_due_today';
      sev := 'warning';
      ntitle := 'Maintenance due today: ' || rec.title;
      nmsg := format('%s at %s is scheduled for today.',
                     rec.title,
                     coalesce(rec.property_name, 'the property'));
    else
      ntype := 'maintenance_upcoming';
      sev := 'info';
      ntitle := format('Maintenance in %s day(s): %s', days_until, rec.title);
      nmsg := format('%s at %s is scheduled for %s.',
                     rec.title,
                     coalesce(rec.property_name, 'the property'),
                     rec.scheduled_date::text);
    end if;

    nlink := format('/dashboard/maintenance/%s', rec.id);

    insert into public.notifications (user_id, type, title, message, severity, link, metadata)
    values (rec.user_id, ntype, ntitle, nmsg, sev, nlink,
            jsonb_build_object(
              'maintenance_id', rec.id,
              'property_id', rec.property_id,
              'scheduled_date', rec.scheduled_date::text,
              'days_until', days_until,
              'priority', rec.priority
            ));
    inserted := inserted + 1;
  end loop;

  return inserted;
end;
$$;

-- 2) extend scan endpoint to also run this scan -----------------------
-- (handled in /api/notifications/scan — that endpoint already calls
--  lease/document/recurring. Add maintenance here.)
-- (covered by app code in lib/api — see POST /api/notifications/scan)

-- 3) schedule via pg_cron ---------------------------------------------------
do $$
declare
  existing bigint;
begin
  select jobid into existing from cron.job where jobname = 'maintenance_reminder_scan_daily';
  if existing is not null then perform cron.unschedule(existing); end if;
end $$;

select cron.schedule(
  'maintenance_reminder_scan_daily',
  '15 7 * * *', -- 5 min after document scan
  $$ select public.run_maintenance_reminder_scan(); $$
);
