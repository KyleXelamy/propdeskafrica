import { withAuth, successResponse, errorResponse } from "@/lib/api"
import { stkQuery } from "@/lib/mpesa/daraja"
import { createClient } from "@supabase/supabase-js"

/**
 * GET /api/subscription/checkout-status?checkout=<CheckoutRequestID>
 * Polls Daraja for the latest status of a subscription STK push. When the
 * push completes successfully, this handler also promotes the user's
 * subscription from 'trialing' → 'active' and sets current_period_end.
 */
export const GET = withAuth(async (req, { supabase, userId }) => {
  const url = new URL(req.url)
  const checkout = url.searchParams.get("checkout")
  if (!checkout) return errorResponse("Provide ?checkout=", 400)

  // Look up our recorded intent
  const { data: row, error: rowErr } = await supabase
    .from("subscription_payments")
    .select("*")
    .eq("checkout_request_id", checkout)
    .eq("user_id", userId)
    .maybeSingle()
  if (rowErr) return errorResponse(rowErr.message, 500)

  if (row && (row.status === "active" || row.status === "subscribed" || row.status === "failed")) {
    return successResponse(row)
  }

  const result = await stkQuery(checkout).catch((e) => ({ error: e.message })) as any
  if (result.error) return errorResponse(result.error, 502)

  const completed = result.ResultCode === "0"
  const newStatus = result.ResultCode === null ? "pending" : completed ? "active" : "failed"

  // Update our payment record
  const url2 = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const adminClient = url2 && serviceKey
    ? createClient(url2, serviceKey, { auth: { persistSession: false } })
    : supabase

  if (row) {
    await adminClient
      .from("subscription_payments")
      .update({
        status: newStatus,
        result_code: result.ResultCode,
        result_desc: result.ResultDesc,
        completed_at: completed ? new Date().toISOString() : null,
      })
      .eq("id", row.id)
  }

  // If completed, promote the subscription
  if (completed && row) {
    const periodEnd = new Date(Date.now() + 30 * 86400000).toISOString()
    await adminClient
      .from("subscriptions")
      .upsert({
        user_id: userId,
        plan_code: row.plan_code,
        status: "active",
        current_period_start: new Date().toISOString(),
        current_period_end: periodEnd,
        last_payment_id: row.id,
        last_payment_method: "mpesa_stk",
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" })
    await adminClient.from("subscription_events").insert({
      user_id: userId,
      event: "payment_succeeded",
      to_plan: row.plan_code,
      to_status: "active",
      days_granted: 30,
      reason: "STK push confirmed",
      actor: "system",
      metadata: { payment_id: row.id },
    })
  }

  return successResponse({
    status: newStatus,
    plan: row?.plan_code,
    amount: row?.amount,
    result_desc: result.ResultDesc,
  })
})