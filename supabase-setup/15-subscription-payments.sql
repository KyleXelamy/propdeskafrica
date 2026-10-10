-- ============================================================
-- 15-subscription-payments.sql
-- Subscription payment intents (STK Push attempts for plans)
-- ============================================================

create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_code text not null references public.plans(code),
  amount integer not null check (amount > 0),
  phone text not null,
  checkout_request_id text unique,
  merchant_request_id text,
  stripe_session_id text unique,
  stripe_payment_intent_id text,
  status text not null default 'initiated'
    check (status in ('initiated','pending','active','subscribed','failed','canceled')),
  result_code text,
  result_desc text,
  mpesa_receipt text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists subscription_payments_user_idx on public.subscription_payments (user_id, created_at desc);
create index if not exists subscription_payments_status_idx on public.subscription_payments (status);

alter table public.subscription_payments enable row level security;

drop policy if exists "subscription_payments_select_own" on public.subscription_payments;
create policy "subscription_payments_select_own" on public.subscription_payments
  for select using (auth.uid() = user_id);

drop policy if exists "subscription_payments_insert_self" on public.subscription_payments;
create policy "subscription_payments_insert_self" on public.subscription_payments
  for insert with check (auth.uid() = user_id);
