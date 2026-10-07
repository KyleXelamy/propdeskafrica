import { successResponse } from "@/lib/api"

/**
 * GET /api/plans
 * Public list of subscription plans. Used by /pricing.
 */
export async function GET() {
  // Static plan data — we keep this in code as the source of truth for
  // marketing copy, while the SQL `plans` table mirrors the same values
  // for in-app entitlement checks.
  return successResponse([
    {
      code: "solo",
      name: "Solo",
      tagline: "For a single landlord just getting started",
      price: 990,
      cadence: "KES / month",
      max_properties: 3,
      max_tenants: 10,
      features: [
        "Up to 3 properties",
        "Up to 10 tenants",
        "M-Pesa rent collection",
        "Maintenance & documents",
        "Email support",
      ],
      cta: "Start 14-day trial",
      highlight: false,
    },
    {
      code: "pro",
      name: "Pro",
      tagline: "For landlords running a real portfolio",
      price: 2490,
      cadence: "KES / month",
      max_properties: 25,
      max_tenants: 100,
      features: [
        "Up to 25 properties",
        "Up to 100 tenants",
        "STK Push + Paybill C2B",
        "Tenant portal",
        "Recurring expenses + expiry alerts",
        "Priority support",
      ],
      cta: "Start 14-day trial",
      highlight: true,
    },
    {
      code: "agency",
      name: "Agency",
      tagline: "For agencies managing many landlords",
      price: 7900,
      cadence: "KES / month",
      max_properties: null,
      max_tenants: null,
      features: [
        "Unlimited properties",
        "Unlimited tenants",
        "Multi-landlord + team members",
        "Reconciliation rules",
        "White-label tenant portal",
        "Dedicated support",
      ],
      cta: "Talk to us",
      highlight: false,
    },
  ])
}
