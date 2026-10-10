-- Payment hardening: one PropDesk Africa plan, idempotent subscription events, and callback protection.
update public.plans
set name = 'PropDesk Africa', description = 'One complete workspace for landlords and property teams', price_kes = 2490,
    max_properties = null, max_tenants = null,
    features = '["Unlimited properties and tenants", "M-Pesa STK Push + Paybill C2B", "Tenant portal, contacts, maintenance and documents", "Reports, reconciliation and exports", "14-day free trial"]'::jsonb,
    active = true, sort_order = 1
where code = 'pro';

update public.subscriptions set plan_code = 'pro' where plan_code in ('solo', 'agency');
update public.plans set active = false where code in ('solo', 'agency');

create unique index if not exists subscription_events_payment_success_unique
on public.subscription_events (user_id, (metadata->>'payment_id'))
where event = 'payment_succeeded' and metadata ? 'payment_id';

alter table public.subscription_payments add column if not exists transaction_date text;
alter table public.subscription_payments add column if not exists raw_callback jsonb;

-- Keep payment rows readable only by their owner; callbacks use service role.
alter table public.subscription_payments enable row level security;
