import { withAuth, successResponse, errorResponse } from "@/lib/api"

async function safeRpc(
  supabase: any,
  fn: string,
): Promise<{ data: number; error: string | null }> {
  const r = await supabase.rpc(fn)
  if (r.error) {
    if (/function .* does not exist/i.test(r.error.message)) {
      return { data: 0, error: null } // not installed — degrade silently
    }
    return { data: 0, error: r.error.message }
  }
  return { data: typeof r.data === "number" ? r.data : 0, error: null }
}

/**
 * POST /api/notifications/scan
 * Manually triggers all four scans via the Postgres functions. Useful as a
 * "Run scan" button — does not require waiting for cron. Functions that
 * haven't been installed yet degrade silently to a count of 0.
 */
export const POST = withAuth(async (_req, { supabase, userId: _ }) => {
  const [lease, doc, recurring, maintenance] = await Promise.all([
    safeRpc(supabase, "run_lease_expiry_scan"),
    safeRpc(supabase, "run_document_expiry_scan"),
    safeRpc(supabase, "run_recurring_expenses"),
    safeRpc(supabase, "run_maintenance_reminder_scan"),
  ])

  const errors = [lease, doc, recurring, maintenance].filter((r) => r.error).map((r) => r.error)
  if (errors.length > 0) {
    return errorResponse(errors.join("; "), 500)
  }

  return successResponse({
    lease_inserted: lease.data,
    document_inserted: doc.data,
    recurring_inserted: recurring.data,
    maintenance_inserted: maintenance.data,
  })
})
