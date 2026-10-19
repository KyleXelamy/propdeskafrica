-- Subscription lifecycle hardening: idempotent trial creation and expiry visibility.

create or replace function public.ensure_subscription(p_user uuid)
returns public.subscriptions
language plpgsql
security invoker
set search_path = public
as $$
declare
  s public.subscriptions;
begin
  select * into s from public.subscriptions where user_id = p_user;
  if not found then
    insert into public.subscriptions (user_id, plan_code, status, trial_ends_at, current_period_start)
    values (p_user, 'pro', 'trialing', now() + interval '14 days', now())
    on conflict (user_id) do nothing
    returning * into s;
    if s.id is null then
      select * into s from public.subscriptions where user_id = p_user;
    else
      insert into public.subscription_events (user_id, event, to_plan, to_status, reason, actor)
      values (p_user, 'created', 'pro', 'trialing', 'auto: signup', 'system');
    end if;
  end if;
  return s;
end;
$$;

create or replace function public.subscription_status(p_user uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  s public.subscriptions;
  p public.plans;
  trial_expired boolean;
begin
  select * into s from public.subscriptions where user_id = p_user;
  if not found then
    return jsonb_build_object('has_subscription', false, 'is_active', false, 'is_trialing', false, 'trial_expired', false, 'days_left', 0, 'plan', null, 'reason', 'no_subscription');
  end if;
  select * into p from public.plans where code = s.plan_code;
  trial_expired := s.status = 'trialing' and s.trial_ends_at is not null and s.trial_ends_at <= now();
  return jsonb_build_object(
    'has_subscription', true,
    'is_active', not trial_expired and s.status not in ('canceled', 'expired', 'past_due'),
    'is_trialing', s.status = 'trialing' and not trial_expired,
    'trial_expired', trial_expired,
    'days_left', case when trial_expired then 0 when s.status = 'trialing' then greatest(0, ceil(extract(epoch from (s.trial_ends_at - now())) / 86400))::int when s.current_period_end is not null then greatest(0, ceil(extract(epoch from (s.current_period_end - now())) / 86400))::int else 0 end,
    'plan', p.code,
    'plan_name', p.name,
    'reason', case when trial_expired then 'trial_ended' else s.status end
  );
end;
$$;
