import { withAuth, successResponse, errorResponse, HttpError } from "@/lib/api"
import { stkQuery } from "@/lib/mpesa/daraja"

/**
 * GET /api/mpesa/status?checkout=<CheckoutRequestID>
 * Polls Daraja for the latest status of an STK push. The browser polls
 * this every few seconds after the user clicks "Pay with M-Pesa".
 */
export const GET = withAuth(async (req, { supabase, userId }) => {
  const url = new URL(req.url)
  const checkout = url.searchParams.get("checkout")
  if (!checkout) throw new HttpError("Provide ?checkout=", 400)

  // Confirm the transaction belongs to the caller
  const { data: row, error: rowErr } = await supabase
    .from("mpesa_transactions")
    .select("id, status, result_desc, raw_response, checkout_request_id")
    .eq("checkout_request_id", checkout)
    .eq("user_id", userId)
    .maybeSingle()
  if (rowErr) return errorResponse(rowErr.message, 500)

  // Already completed/failed locally — short-circuit
  if (row && (row.status === "completed" || row.status === "failed" || row.status === "cancelled")) {
    return successResponse(row)
  }

  const result = await stkQuery(checkout).catch((e) => ({ error: e.message }))
  if ((result as any).error) return errorResponse((result as any).error, 502)

  const completed = (result as any).ResultCode === "0"
  const newStatus = (result as any).ResultCode === null || (result as any).ResultCode === undefined
    ? "pending"
    : completed ? "completed" : "failed"

  if (row) {
    const { data: updated } = await supabase
      .from("mpesa_transactions")
      .update({
        status: newStatus,
        result_code: (result as any).ResultCode ?? null,
        result_desc: (result as any).ResultDesc ?? null,
        raw_response: result,
        completed_at: newStatus === "completed" ? new Date().toISOString() : null,
      })
      .eq("id", row.id)
      .select()
      .single()
    return successResponse(updated || row)
  }
  return successResponse({ checkout_request_id: checkout, status: newStatus, raw_response: result })
})
