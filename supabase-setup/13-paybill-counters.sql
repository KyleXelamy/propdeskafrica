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
as $$
  update public.paybills
  set matched_count = matched_count + case when p_matched then 1 else 0 end,
      unmatched_count = unmatched_count + case when p_matched then 0 else 1 end,
      last_payment_at = now()
  where id = p_paybill_id;
$$;

grant execute on function public.bump_paybill_counters(uuid, boolean) to service_role, anon, authenticated;