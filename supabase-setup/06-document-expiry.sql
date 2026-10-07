-- ============================================================
-- 06-document-expiry.sql
-- Document expiry tracking + auto-notifications
-- ============================================================

alter table public.documents
  add column if not exists expiry_date date,
  add column if not exists reminder_days_before integer not null default 30
    check (reminder_days_before between 0 and 365);

create index if not exists documents_expiry_date_idx
  on public.documents (expiry_date)
  where expiry_date is not null;

-- 1) function: notify on soon-to-expire documents ----------------------------
-- De-dupes by (document_id, expiry_date) so we only fire once per document
-- per expiry date.

create or replace function public.run_document_expiry_scan()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  inserted integer := 0;
  days_left integer;
  sev text;
  ntype text;
  ntitle text;
  nmsg text;
  nlink text;
begin
  for rec in
    select d.id, d.user_id, d.title, d.name, d.expiry_date, d.reminder_days_before,
           d.property_id, d.tenant_id,
           p.name as property_name
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
      ntype := 'document_expired';
      sev := 'critical';
      ntitle := 'Document expired: ' || coalesce(rec.title, rec.name, 'Untitled');
      nmsg := format('%s expired %s day(s) ago.',
                     coalesce(rec.title, rec.name, 'Untitled'),
                     abs(days_left));
    elsif days_left <= 7 then
      ntype := 'document_expiring_critical';
      sev := 'critical';
      ntitle := 'Document expiring soon: ' || coalesce(rec.title, rec.name, 'Untitled');
      nmsg := format('%s expires in %s day(s).',
                     coalesce(rec.title, rec.name, 'Untitled'),
                     days_left);
    else
      ntype := 'document_expiring_upcoming';
      sev := 'warning';
      ntitle := 'Document expiring: ' || coalesce(rec.title, rec.name, 'Untitled');
      nmsg := format('%s expires on %s (%s day(s) away).',
                     coalesce(rec.title, rec.name, 'Untitled'),
                     rec.expiry_date::text,
                     days_left);
    end if;

    if rec.property_id is not null then
      nlink := format('/dashboard/properties/%s', rec.property_id);
    else
      nlink := '/dashboard/documents';
    end if;

    insert into public.notifications (user_id, type, title, message, severity, link, metadata)
    values (rec.user_id, ntype, ntitle, nmsg, sev, nlink,
            jsonb_build_object(
              'document_id', rec.id,
              'property_id', rec.property_id,
              'expiry_date', rec.expiry_date::text,
              'days_left', days_left
            ));
    inserted := inserted + 1;
  end loop;

  return inserted;
end;
$$;

-- 2) extend the scan endpoint to also run this scan -----------------------

-- 3) schedule via pg_cron ---------------------------------------------------
-- Wrapped so plain Postgres / Neon (no pg_cron) doesn't break the
-- migration. Use POST /api/cron/run from an external scheduler instead.
do $pgc$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron not available — skipping in-DB schedule. Use /api/cron/run externally.';
    return;
  end;
  if exists (select 1 from cron.job where jobname = 'document_expiry_scan_daily') then
    perform cron.unschedule((select jobid from cron.job where jobname = 'document_expiry_scan_daily' limit 1));
  end if;
  perform cron.schedule(
    'document_expiry_scan_daily',
    '10 7 * * *',
    $sql$ select public.run_document_expiry_scan(); $sql$
  );
exception when others then
  raise notice 'pg_cron scheduling failed: %', SQLERRM;
end
$pgc$;
