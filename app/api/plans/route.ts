import { successResponse } from "@/lib/api"

/**
 * GET /api/plans
 * Public list of subscription plans. Used by /pricing.
 */
export async function GET() {
  return successResponse([{
    code: "pro",
    name: "PropDesk Africa",
    tagline: "One complete workspace for landlords and property teams",
    price: 2490,
    cadence: "KES / month",
    max_properties: null,
    max_tenants: null,
    features: [
      "Unlimited properties and tenants",
      "M-Pesa STK Push + Paybill C2B",
      "Tenant portal, contacts, maintenance and documents",
      "Reports, reconciliation and exports",
      "14-day free trial",
    ],
    cta: "Start 14-day trial",
    highlight: true,
  }])
}
