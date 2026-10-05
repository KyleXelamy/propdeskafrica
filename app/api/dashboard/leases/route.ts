import { withAuth, successResponse } from "@/lib/api"

/**
 * GET /api/dashboard/leases
 * Returns tenants whose leases are expiring within the next 60 days,
 * ordered by urgency. Includes the property name so the UI can show
 * a useful one-liner per row.
 */
export const GET = withAuth(async (_req, { supabase, userId }) => {
  const now = new Date()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() + 60)

  const { data, error } = await supabase
    .from("tenants")
    .select(`
      id,
      full_name,
      first_name,
      last_name,
      email,
      phone,
      lease_end_date,
      properties (id, name)
    `)
    .eq("user_id", userId)
    .eq("status", "active")
    .not("lease_end_date", "is", null)
    .lte("lease_end_date", cutoff.toISOString().slice(0, 10))
    .order("lease_end_date", { ascending: true })

  if (error) return successResponse([]) // never 500 on this — UI degrades gracefully

  const rows = (data || []).map((t) => {
    const end = new Date(t.lease_end_date)
    const days = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return {
      tenant_id: t.id,
      tenant_name: t.full_name || [t.first_name, t.last_name].filter(Boolean).join(" ") || "—",
      tenant_email: t.email,
      tenant_phone: t.phone,
      property_id: (t.properties as any)?.id || null,
      property_name: (t.properties as any)?.name || "—",
      lease_end_date: t.lease_end_date,
      days_until_expiry: days,
      severity: days < 0 ? "expired" : days <= 7 ? "critical" : days <= 30 ? "warning" : "upcoming",
    }
  })

  return successResponse(rows)
})
