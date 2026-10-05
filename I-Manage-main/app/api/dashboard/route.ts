import { withAuth, successResponse } from "@/lib/api"

/**
 * GET /api/dashboard — returns the four top-level stats for the home
 * dashboard: total properties, active tenants, monthly revenue, and
 * open maintenance requests.
 */
export const GET = withAuth(async (_req, { supabase, userId }) => {
  const now = new Date()
  const firstOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const lastOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59))

  const [props, tenants, maintenance, paidThisMonth, openRequests, urgentRequests] = await Promise.all([
    supabase.from("properties").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("tenants").select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("status", "active"),
    supabase.from("maintenance_requests").select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("status", "open"),
    supabase.from("rent_payments").select("amount").eq("user_id", userId)
      .in("status", ["paid", "completed"])
      .gte("payment_date", firstOfMonth.toISOString())
      .lte("payment_date", lastOfMonth.toISOString()),
    supabase.from("maintenance_requests").select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("status", "open"),
    supabase.from("maintenance_requests").select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("priority", "urgent").neq("status", "completed"),
  ])

  const monthlyRevenue = (paidThisMonth.data || []).reduce((s, p) => s + Number(p.amount || 0), 0)

  return successResponse({
    properties: props.count || 0,
    activeTenants: tenants.count || 0,
    monthlyRevenue,
    openMaintenance: maintenance.count || 0,
    urgentMaintenance: urgentRequests.count || 0,
  })
})
