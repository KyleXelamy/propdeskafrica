-- Single-price plan.
--
-- New users receive a 14-day trial, then pay KES 2,490/month whether they
-- manage 3 units or 100. There is no free-forever plan or unit-based tier.
--
-- This is a new patch rather than an edit to 14-subscriptions.sql, because
-- 14 has already been applied to live databases — editing its seed values
-- would change nothing on any install that ran it, and the patch runner
-- never re-runs a recorded patch.
--
-- Idempotent: safe to apply repeatedly.

-- Pro: one price, unlimited units. Tenant portal features are gone — the
-- tenant portal was removed from the product.
insert into public.plans
  (code, name, description, price_kes, max_properties, max_tenants, max_team_members, features, sort_order)
values
  ('pro', 'Pro', 'Unlimited units, every feature', 2490, null, null, 3,
   '["Unlimited units & tenants", "Native M-Pesa STK Push rent collection", "Paybill / till integration with auto-reconciliation", "Quotations & approvals workflow", "Damages tracking & inspections", "Recurring expenses & document expiry alerts", "Document vault (10 GB)", "Priority support"]'::jsonb, 2)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  price_kes = excluded.price_kes,
  max_properties = excluded.max_properties,
  max_tenants = excluded.max_tenants,
  max_team_members = excluded.max_team_members,
  features = excluded.features,
  sort_order = excluded.sort_order,
  active = true;

-- Retire the old tiers rather than deleting them: an existing subscription
-- may still point at 'solo' or 'agency', and we do not want to orphan a
-- customer's billing history.
update public.plans set active = false where code in ('solo', 'agency');

-- Any subscription parked on a retired tier moves to Pro, preserving its
-- renewal date so nobody loses time they have already paid for.
update public.subscriptions
   set plan_code = 'pro',
       updated_at = now()
 where plan_code in ('solo', 'agency');
