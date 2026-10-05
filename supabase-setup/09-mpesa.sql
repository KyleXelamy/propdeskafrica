-- ============================================================
-- 09-mpesa.sql
-- M-Pesa STK Push transactions table
-- ============================================================

create table if not exists public.mpesa_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
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

alter table public.mpesa_transactions enable row level security;

drop policy if exists "mpesa_transactions_select_own" on public.mpesa_transactions;
create policy "mpesa_transactions_select_own" on public.mpesa_transactions
  for select using (auth.uid() = user_id);

drop policy if exists "mpesa_transactions_insert_own" on public.mpesa_transactions;
create policy "mpesa_transactions_insert_own" on public.mpesa_transactions
  for insert with check (auth.uid() = user_id);

drop policy if exists "mpesa_transactions_update_own" on public.mpesa_transactions;
create policy "mpesa_transactions_update_own" on public.mpesa_transactions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Service role bypasses RLS so the public callback (no auth) can write.
