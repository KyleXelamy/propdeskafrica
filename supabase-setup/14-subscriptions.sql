-- ============================================================
-- 14-subscriptions.sql
-- Subscription plans + per-user subscription state + trial logic
-- ============================================================
--
-- Three plans: Solo (KES 990), Pro (KES 2,490), Agency (KES 7,900)
-- 14-day trial auto-applied at signup, can be extended manually
-- (admin tool) for users who pay via bank transfer / direct card.

-- 1) plans table ---------------------------------------------------------
create table if not exists public.plans (
  code text primary key,             -- 'solo' | 'pro' | 'agency'
  name text not null,
  description text,
  price_kes integer not null,        -- monthly price in KES
  max_properties integer,            -- nullable = unlimited
  max_tenants integer,
  max_team_members integer default 1,
  features jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.plans (code, name, description, price_kes, max_properties, max_tenants, max_team_members, features, sort_order) values
  ('solo', 'Solo', 'For a single landlord with up to 3 properties', 990, 3, 10, 1,
   '["Up to 3 properties", "Up to 10 tenants", "M-Pesa rent collection", "Reports & exports", "Email support"]'::jsonb, 1),
  ('pro', 'Pro', 'For landlords running a real portfolio', 2490, 25, 100, 3,
   '["Up to 25 properties", "Up to 100 tenants", "M-Pesa STK push + Paybill C2B", "Tenant portal", "Recurring expenses + document expiry", "Priority support"]'::jsonb, 2),
  ('agency', 'Agency', 'For agencies managing many landlords', 7900, null, null, 25,
   '["Unlimited properties", "Unlimited tenants", "Multi-landlord + team members", "Reconciliation rules", "White-label tenant portal", "Dedicated support"]'::jsonb, 3)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  price_kes = excluded.price_kes,
  max_properties = excluded.max_properties,
  max_tenants = excluded.max_tenants,
  max_team_members = excluded.max_team_members,
  features = excluded.features,
  sort_order = excluded.sort_order;

-- 2) subscriptions table ------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  plan_code text not null references public.plans(code),
  status text not null default 'trialing'
    check (status in ('trialing','active','past_due','canceled','expired')),
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at timestamptz,
  canceled_at timestamptz,
  -- payment reference (M-Pesa STK push for the subscription, or manual)
  last_payment_id uuid,
  last_payment_method text,        -- 'mpesa_stk' | 'mpesa_paybill' | 'manual_bank' | 'manual_card' | 'comp'
  notes text,
  -- soft quota tracking
  properties_count integer not null default 0,
  tenants_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_status_idx on public.subscriptions (status);
create index if not exists subscriptions_trial_ends_idx on public.subscriptions (trial_ends_at)
  where status = 'trialing';

-- 3) subscription_events table (audit trail) -----------------------------
create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event text not null,             -- 'created' | 'upgraded' | 'downgraded' | 'canceled' | 'reactivated' | 'extended' | 'manual_grant' | 'payment_succeeded' | 'payment_failed' | 'expired'
  from_plan text,
  to_plan text,
  from_status text,
  to_status text,
  days_granted integer,            -- for manual extensions
  reason text,
  actor text,                      -- 'system' | user id of admin who did it
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists subscription_events_user_idx on public.subscription_events (user_id, created_at desc);

-- 4) helper: ensure a subscription row exists for a user ----------------
-- Called from the middleware on every dashboard request. Idempotent.
-- If no row exists, creates one in 'trialing' state with a 14-day window
-- starting now.
create or replace function public.ensure_subscription(p_user uuid)
returns public.subscriptions
language plpgsql
as $$
declare
  s public.subscriptions;
begin
  select * into s from public.subscriptions where user_id = p_user;
  if not found then
    insert into public.subscriptions (user_id, plan_code, status, trial_ends_at, current_period_start)
    values (p_user, 'pro', 'trialing', now() + interval '14 days', now())
    returning * into s;
    insert into public.subscription_events (user_id, event, to_plan, to_status, reason, actor)
    values (p_user, 'created', 'pro', 'trialing', 'auto: signup', 'system');
  end if;
  return s;
end;
$$;

-- 5) helper: is the user allowed to use the dashboard? ------------------
-- Returns a json object with booleans so the app can decide what to show.
create or replace function public.subscription_status(p_user uuid)
returns jsonb
language plpgsql
stable
as $$
declare
  s public.subscriptions;
  p public.plans;
  result jsonb;
begin
  select * into s from public.subscriptions where user_id = p_user;
  if not found then
    return jsonb_build_object(
      'has_subscription', false,
      'is_active', false,
      'is_trialing', false,
      'trial_expired', false,
      'days_left', 0,
      'plan', null,
      'reason', 'no_subscription'
    );
  end if;

  select * into p from public.plans where code = s.plan_code;

  if s.status = 'trialing' and s.trial_ends_at is not null and s.trial_ends_at < now() then
    return jsonb_build_object(
      'has_subscription', true,
      'is_active', false,
      'is_trialing', false,
      'trial_expired', true,
      'days_left', 0,
      'plan', p.code,
      'reason', 'trial_ended'
    );
  end if;

  if s.status in ('canceled', 'expired', 'past_due') then
    return jsonb_build_object(
      'has_subscription', true,
      'is_active', false,
      'is_trialing', false,
      'trial_expired', false,
      'days_left', 0,
      'plan', p.code,
      'reason', s.status
    );
  end if;

  -- active or trialing-with-time-left
  result := jsonb_build_object(
    'has_subscription', true,
    'is_active', true,
    'is_trialing', s.status = 'trialing',
    'trial_expired', false,
    'days_left', case
      when s.status = 'trialing' and s.trial_ends_at is not null
        then greatest(0, ceil(extract(epoch from (s.trial_ends_at - now())) / 86400))::int
      when s.current_period_end is not null
        then greatest(0, ceil(extract(epoch from (s.current_period_end - now())) / 86400))::int
      else 0
    end,
    'plan', p.code,
    'reason', s.status
  );
  return result;
end;
$$;

-- 6) subscription updates are driven by user payments and system events.

-- 7) trigger: stamp updated_at on subscription changes -------------------
create or replace function public.subscriptions_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists subscriptions_touch on public.subscriptions;
create trigger subscriptions_touch
  before update on public.subscriptions
  for each row execute function public.subscriptions_touch_updated_at();

-- 8) RLS ----------------------------------------------------------------
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_events enable row level security;

-- Everyone can read plans (publicly listed on /pricing)
drop policy if exists "plans_select_all" on public.plans;
create policy "plans_select_all" on public.plans for select using (active = true);

-- Users can see their own subscription
drop policy if exists "subs_select_own" on public.subscriptions;
create policy "subs_select_own" on public.subscriptions for select using (auth.uid() = user_id);

drop policy if exists "subs_insert_self" on public.subscriptions;
create policy "subs_insert_self" on public.subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists "subs_update_self" on public.subscriptions;
create policy "subs_update_self" on public.subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Users can read their own events
drop policy if exists "subsevents_select_own" on public.subscription_events;
create policy "subsevents_select_own" on public.subscription_events for select using (auth.uid() = user_id);
