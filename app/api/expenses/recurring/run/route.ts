import { withAuth, successResponse, errorResponse } from "@/lib/api"

/**
 * POST /api/expenses/recurring/run
 * Manually trigger the recurring-expense generator. Useful for testing
 * and for the "Generate now" button in the UI.
 */
export const POST = withAuth(async (_req, { supabase, userId: _ }) => {
  // withAuth is still required for the CSRF/origin check, but the function
  // itself is SECURITY DEFINER and doesn't need the user id.
  const { data, error } = await supabase.rpc("run_recurring_expenses")
  if (error) {
    if (/function .* does not exist/i.test(error.message)) {
      return errorResponse(
        "Recurring expenses function not installed. Run supabase-setup/05-recurring-expenses.sql first.",
        501,
      )
    }
    return errorResponse(error.message, 500)
  }
  return successResponse({ inserted: typeof data === "number" ? data : 0 })
})
