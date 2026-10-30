-- ============================================================
-- 13-paybill-counters.sql
-- Atomic paybill counter bump used by the C2B confirmation
-- callback. Replaces per-row updates so concurrent Daraja
-- callbacks don't lose increments.
-- ============================================================

create or replace function public.bump_paybill_counters(p_paybill_id uuid, p_matched boolean)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.paybills
  set matched_count = matched_count + case when p_matched then 1 else 0 end,
      unmatched_count = unmatched_count + case when p_matched then 0 else 1 end,
      last_payment_at = now()
  where id = p_paybill_id;
$$;

-- INFRA-016: `grant execute ... to service_role, anon, authenticated` let any
-- anonymous internet caller POST to /rest/v1/rpc/bump_paybill_counters and
-- inflate the matched/unmatched counters on ANY landlord's paybill. A
-- SECURITY DEFINER function is executable by PUBLIC by default, so the
-- explicit grants were not enough on their own — revoke from PUBLIC too.
--
-- The legitimate caller is the Daraja C2B callback, which uses the
-- service-role client (app/api/mpesa/c2b/confirmation/route.ts), so the
-- function behaviour is unchanged for it.
revoke execute on function public.bump_paybill_counters(uuid, boolean) from public;
revoke execute on function public.bump_paybill_counters(uuid, boolean) from anon;
revoke execute on function public.bump_paybill_counters(uuid, boolean) from authenticated;
grant execute on function public.bump_paybill_counters(uuid, boolean) to service_role;