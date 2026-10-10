-- PROPDESK AFRICA signup bootstrap
-- Safe to run independently before the rest of the schema setup.

create table if not exists public.user_profiles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null unique,
  full_name text,
  first_name text,
  last_name text,
  company_name text,
  phone text,
  address text,
  city text,
  county text,
  timezone text default 'Africa/Nairobi',
  currency text default 'KES',
  date_format text default 'DD/MM/YYYY',
  notification_preferences jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.user_profiles enable row level security;

drop policy if exists "Users can view their own user profile" on public.user_profiles;
drop policy if exists "Users can insert their own user profile" on public.user_profiles;
drop policy if exists "Users can update their own user profile" on public.user_profiles;
create policy "Users can view their own user profile" on public.user_profiles for select using ((select auth.uid()) = user_id);
create policy "Users can insert their own user profile" on public.user_profiles for insert with check ((select auth.uid()) = user_id);
create policy "Users can update their own user profile" on public.user_profiles for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into public.user_profiles (user_id, full_name, created_at, updated_at)
    values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), now(), now())
    on conflict (user_id) do nothing;
  exception when others then
    raise warning 'handle_new_user profile insert skipped [%]: %', sqlstate, sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

notify pgrst, 'reload schema';
