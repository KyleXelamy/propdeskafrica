import { withAuth, successResponse, errorResponse, dbError } from "@/lib/api"
import { stkQuery, darajaConfig } from "@/lib/mpesa/daraja"
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
  if (rowErr) return dbError("subscription/checkout-status", rowErr, 500)

  if (row && (row.status === "active" || row.status === "subscribed" || row.status === "failed")) {
    return successResponse(row)
  }

  const result = await stkQuery(checkout).catch((e) => ({ error: e.message })) as any
  if (result.error) {
    console.error("[api] subscription/checkout-status daraja query failed", result.error)
    return errorResponse("Could not reach the M-Pesa gateway", 502)
  }

  // INFRA-007: the library refuses to mock outside development/test, but the
  // entitlement decision lives HERE, so it has to refuse a mocked result too.
  // A simulated Daraja response must never activate a paid plan — not even in
  // a development environment where the mock is legitimately reachable.
  if (result.mocked) {
    console.warn("[api] subscription/checkout-status refused a MOCKED Daraja result", {
      checkout,
    })
    return errorResponse("Payment could not be verified", 502)
  }

  // INFRA-007, second half: in a production runtime the entitlement may only
  // come from the real Daraja gateway. A sandbox response must not activate a
  // paid plan in production, whatever the transport looked like. (A sandbox
  // runtime is left alone so the flow can still be exercised in staging.)
  if (process.env.NODE_ENV === "production" && darajaConfig().env !== "production") {
    console.warn("[api] subscription/checkout-status refused a non-production Daraja result", {
      checkout,
    })
    return errorResponse("Payment could not be verified", 502)
  }

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