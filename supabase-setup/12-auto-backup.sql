-- ============================================================
-- 12-auto-backup.sql
-- Per-user auto-backup settings + cleanup of old backups.
-- ============================================================

alter table public.user_profiles
  add column if not exists auto_backup boolean not null default false,
  add column if not exists auto_backup_frequency text not null default 'weekly' check (auto_backup_frequency in ('daily', 'weekly', 'monthly'));

-- Keep the last 50 backups per user. Older rows auto-prune on the next backup run.
create or replace function public.prune_old_backups()
returns integer
language plpgsql
security definer
as $$
declare
  pruned integer;
begin
  with ranked as (
    select id, user_id,
           row_number() over (partition by user_id order by created_at desc) as rn
    from public.backups
  )
  delete from public.backups b
  using ranked r
  where b.id = r.id and r.rn > 50;
  get diagnostics pruned = row_count;
  return pruned;
end;
$$;

grant execute on function public.prune_old_backups() to service_role, authenticated;

-- Updated_at for the new columns is already handled by touch_updated_at
-- if the table has that trigger; if not, create it idempotently.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'user_profiles_touch_updated_at'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'updated_at'
  ) then
    create trigger user_profiles_touch_updated_at
      before update on public.user_profiles
      for each row execute function public.touch_updated_at();
  end if;
end $$;