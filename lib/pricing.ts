/**
 * Pricing — the single source of truth.
 *
 * Why this file exists: the marketing pricing page, the public /api/plans
 * route, and the seeded `plans` table each used to carry their own copy of
 * the prices. They drifted. The website showed Solo as "Free" and Agency as
 * "Talk to us", while the API returned KES 990 and KES 7,900 for the same
 * two plans. Four surfaces, three different price lists.
 *
 * The model is deliberately simple and deliberately flat:
 *
 *   PRO   — KES 2,490 per month, whether a landlord manages 3 units or 100.
 *
 * New users receive a 14-day trial. There is no free-forever plan and no
 * unit-based pricing tier.
 *
 * To change pricing, change it HERE and add a migration (see
 * supabase-setup/16-plans-single-price.sql). Do not edit an already-applied
 * migration file to change a price — the patch runner will never re-run it,
 * and the database will keep the old number.
 */

/** The single paid price, in whole KES, per month. */
export const MONTHLY_PRICE_KES = 2490

/** Length of the paid trial offered at sign-up, in days. */
export const TRIAL_DAYS = 14

export type PlanCode = "pro"

export interface Plan {
  /** Stable identifier, shared with the `plans.code` column. */
  code: PlanCode
  name: string
  tagline: string
  /** Whole KES per month. */
  price: number
  cadence: string
  /** null = unlimited. */
  max_properties: number | null
  max_tenants: number | null
  features: string[]
  cta: string
  href: string
  highlight: boolean
}

export const PLANS: Plan[] = [
  {
    code: "pro",
    name: "Pro",
    tagline: "For landlords running a real portfolio",
    price: MONTHLY_PRICE_KES,
    cadence: "KES / month",
    max_properties: null,
    max_tenants: null,
    features: [
      "Unlimited units & tenants",
      "Native M-Pesa STK Push rent collection",
      "Paybill / till integration with auto-reconciliation",
      "Quotations & approvals workflow",
      "Damages tracking & inspections",
      "Recurring expenses & document expiry alerts",
      "Document vault (10 GB)",
      "Priority support",
    ],
    cta: `Start ${TRIAL_DAYS}-day trial`,
    href: "/auth/sign-up",
    highlight: true,
  },
]

/** Display helper — keeps "KES 2,490" formatting identical on every surface. */
export function formatPrice(price: number): string {
  return `KES ${price.toLocaleString("en-KE")}`
}
