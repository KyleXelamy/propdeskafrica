import { successResponse } from "@/lib/api"
import { PLANS } from "@/lib/pricing"

/**
 * GET /api/plans
 * Public list of subscription plans, served straight from lib/pricing.ts
 * so this route and the marketing pricing page can never disagree.
 *
 * The `plans` table mirrors these values for in-app entitlement checks;
 * it is kept in step by supabase-setup/16-plans-single-price.sql.
 */
export async function GET() {
  return successResponse(PLANS)
}
