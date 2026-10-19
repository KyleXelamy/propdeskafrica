-- Billing lifecycle safeguards: replay-safe webhook events and expiry enforcement.
create table if not exists public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text not null,
  processed_at timestamptz not null default now(),
  unique (provider, event_id)
);

alter table public.billing_webhook_events enable row level security;
revoke all on public.billing_webhook_events from anon, authenticated;


create or replace function public.expire_subscriptions()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare affected integer;
begin
  update public.subscriptions
  set status = 'expired', updated_at = now()
  where status = 'trialing' and trial_ends_at is not null and trial_ends_at <= now();
  get diagnostics affected = row_count;
  insert into public.subscription_events (user_id, event, from_status, to_status, reason, actor)
  select user_id, 'expired', 'trialing', 'expired', 'trial_ended', 'system'
  from public.subscriptions
  where status = 'expired' and trial_ends_at is not null and trial_ends_at <= now()
    and not exists (select 1 from public.subscription_events e where e.user_id = subscriptions.user_id and e.event = 'expired' and e.created_at > now() - interval '1 hour');
  return affected;
end;
$$;
