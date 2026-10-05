-- ============================================================
-- 11-backup-patch.sql
-- Self-contained backup + patch/update system.
-- No admin panel. No privileged users. Just data, and the
-- ability to back it up, restore it, and patch the system
-- without disturbing tenants in production.
-- ============================================================

-- ------------------------------------------------------------
-- system_version: single-row table tracking the schema version
-- and the last applied patch. Read by every API to ensure
-- migrations have been run.
-- ------------------------------------------------------------
create table if not exists public.system_version (
  id integer primary key default 1 check (id = 1),
  schema_version integer not null default 0,
  last_patch_id text,
  installed_at timestamptz not null default now(),
  constraint single_row_system_version check (id = 1)
);

insert into public.system_version (id, schema_version) values (1, 0)
  on conflict (id) do nothing;

alter table public.system_version enable row level security;
-- Public read so the app can boot safely without auth.
drop policy if exists "system_version_public_read" on public.system_version;
create policy "system_version_public_read" on public.system_version
  for select using (true);
-- Writes are restricted to the service role (no user policy).

-- ------------------------------------------------------------
-- patches: append-only log of every patch that has been applied
-- to this instance. Each patch has a unique id (timestamp-based)
-- and a JSON body describing what changed.
-- ------------------------------------------------------------
create table if not exists public.patches (
  id text primary key,             -- e.g. "p_2026_10_05_001"
  applied_at timestamptz not null default now(),
  description text not null,
  kind text not null default 'data' check (kind in ('schema', 'data', 'config', 'security')),
  sql text,                         -- optional raw SQL for audit
  reversible boolean not null default true,
  rollback_sql text,                -- optional raw SQL for rollback
  applied_by text default 'system', -- 'system' or a service identifier
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists patches_applied_at_idx on public.patches (applied_at desc);

alter table public.patches enable row level security;
-- Inserts go through the patch runner with service role; users only read.
drop policy if exists "patches_public_read" on public.patches;
create policy "patches_public_read" on public.patches
  for select using (true);

-- ------------------------------------------------------------
-- backups: per-user backup metadata. The actual payload lives
-- in object storage or in the user-backups bucket; we only
-- track pointers here so the dashboard can list/restore.
-- ------------------------------------------------------------
create table if not exists public.backups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  kind text not null default 'full' check (kind in ('full', 'properties', 'tenants', 'payments', 'expenses', 'maintenance', 'documents', 'contacts', 'damages', 'quotations')),
  format text not null default 'json' check (format in ('json', 'csv-zip')),
  size_bytes bigint not null default 0,
  row_count integer not null default 0,
  -- Where the payload lives: 'inline' (stored below) or 'storage' (Supabase Storage)
  storage_kind text not null default 'inline' check (storage_kind in ('inline', 'storage')),
  storage_path text,                 -- if storage_kind = 'storage'
  -- For inline backups, the actual JSON payload. CSVs and zips are too large.
  payload jsonb,
  -- Free-form metadata: app version, schema version, row counts per table
  metadata jsonb not null default '{}'::jsonb,
  source text not null default 'manual' check (source in ('manual', 'scheduled', 'pre-patch', 'pre-migration')),
  created_at timestamptz not null default now()
);

create index if not exists backups_user_idx on public.backups (user_id, created_at desc);
create index if not exists backups_kind_idx on public.backups (user_id, kind, created_at desc);

alter table public.backups enable row level security;

drop policy if exists "backups_select_own" on public.backups;
create policy "backups_select_own" on public.backups
  for select using (auth.uid() = user_id);

drop policy if exists "backups_insert_own" on public.backups;
create policy "backups_insert_own" on public.backups
  for insert with check (auth.uid() = user_id);

drop policy if exists "backups_delete_own" on public.backups;
create policy "backups_delete_own" on public.backups
  for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- backup_runs: log of every backup attempt (success/failure)
-- ------------------------------------------------------------
create table if not exists public.backup_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  format text not null,
  status text not null check (status in ('success', 'failed', 'in_progress')),
  size_bytes bigint,
  row_count integer,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists backup_runs_user_idx on public.backup_runs (user_id, started_at desc);

alter table public.backup_runs enable row level security;

drop policy if exists "backup_runs_select_own" on public.backup_runs;
create policy "backup_runs_select_own" on public.backup_runs
  for select using (auth.uid() = user_id);

drop policy if exists "backup_runs_insert_own" on public.backup_runs;
create policy "backup_runs_insert_own" on public.backup_runs
  for insert with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- restore_runs: every restore attempt, with before/after counts
-- ------------------------------------------------------------
create table if not exists public.restore_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  backup_id uuid references public.backups(id) on delete set null,
  status text not null check (status in ('success', 'failed', 'partial', 'in_progress')),
  -- Counts before and after the restore, per table
  before_counts jsonb not null default '{}'::jsonb,
  after_counts jsonb not null default '{}'::jsonb,
  tables_restored text[] not null default '{}',
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists restore_runs_user_idx on public.restore_runs (user_id, started_at desc);

alter table public.restore_runs enable row level security;

drop policy if exists "restore_runs_select_own" on public.restore_runs;
create policy "restore_runs_select_own" on public.restore_runs
  for select using (auth.uid() = user_id);

drop policy if exists "restore_runs_insert_own" on public.restore_runs;
create policy "restore_runs_insert_own" on public.restore_runs
  for insert with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- helper view: latest backup per user
-- ------------------------------------------------------------
create or replace view public.v_latest_backup_per_user as
  select distinct on (user_id)
    user_id, id as backup_id, label, kind, format, size_bytes, row_count, created_at
  from public.backups
  order by user_id, created_at desc;

-- ------------------------------------------------------------
-- trigger: bump schema_version when a new patch is applied.
-- The patch runner calls this explicitly when applying a patch.
-- ------------------------------------------------------------
create or replace function public.bump_schema_version(patch_id text)
returns void
language sql
as $$
  update public.system_version
  set schema_version = schema_version + 1,
      last_patch_id = patch_id,
      installed_at = now()
  where id = 1;
$$;

-- ------------------------------------------------------------
-- self-check function: returns the system version + last patch
-- ------------------------------------------------------------
create or replace function public.system_health()
returns table (
  schema_version integer,
  last_patch_id text,
  last_patch_at timestamptz,
  installed_at timestamptz
)
language sql
stable
as $$
  select
    v.schema_version,
    v.last_patch_id,
    p.applied_at as last_patch_at,
    v.installed_at
  from public.system_version v
  left join public.patches p on p.id = v.last_patch_id
  where v.id = 1;
$$;

grant execute on function public.system_health() to anon, authenticated;
