-- Additive hardening for payment receiving and reconciliation.
-- Safe to run repeatedly; preserves existing rows.

alter table public.paybills
  add column if not exists is_default boolean not null default false,
  add column if not exists verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'ready', 'verified'));

create index if not exists paybills_default_idx
  on public.paybills (user_id, is_default)
  where active = true;

create table if not exists public.payment_test_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  paybill_id uuid not null references public.paybills(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0 and amount <= 100),
  phone text not null,
  provider_reference text,
  status text not null default 'pending'
    check (status in ('pending', 'submitted', 'completed', 'failed', 'expired')),
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_test_attempts_user_idx
  on public.payment_test_attempts (user_id, created_at desc);

alter table public.payment_test_attempts enable row level security;
drop policy if exists "payment_test_attempts_owner" on public.payment_test_attempts;
create policy "payment_test_attempts_owner" on public.payment_test_attempts
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index if not exists c2b_user_status_created_idx
  on public.c2b_transactions (user_id, match_status, created_at desc);

create index if not exists reconciliation_audit_transaction_idx
  on public.reconciliation_audit (c2b_transaction_id, decided_at desc);
