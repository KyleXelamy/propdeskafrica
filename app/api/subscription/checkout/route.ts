import { withAuth, successResponse, errorResponse, HttpError } from "@/lib/api"
import { stkPush, darajaConfigured } from "@/lib/mpesa/daraja"
import { createClient } from "@supabase/supabase-js"

/**
 * POST /api/subscription/checkout
 * Body: { plan: 'pro', phone: string }
 *
 * Initiates an M-Pesa STK Push for the chosen subscription plan. On
 * confirmation, the subscription is moved from 'trialing' → 'active' and
 * the `current_period_end` is extended by 30 days.
 *
 * The STK push uses an account reference of "SUB-{planCode}" so the
 * callback handler can route it back to the subscription update path.
 */
export const POST = withAuth(async (req, { supabase, userId }) => {
  const body = await req.json().catch(() => ({})) as any
  const plan = (body.plan || "").toString()
  const phone = (body.phone || "").toString().trim()

  if (plan !== "pro") throw new HttpError("PropDesk Africa currently has one subscription plan", 400)
  if (!phone) throw new HttpError("phone required", 400)

  // Resolve plan price
  const { data: planRow, error: planErr } = await supabase
    .from("plans")
    .select("price_kes, code, name")
    .eq("code", plan)
    .single()
  if (planErr || !planRow) throw new HttpError("Plan not found", 404)
  const amount = Number(planRow.price_kes)

  if (!darajaConfigured() && process.env.MPESA_SANDBOX_MOCK !== "1") {
    return errorResponse("M-Pesa not configured. Set MPESA_SANDBOX_MOCK=1 or supply credentials.", 503)
  }

  const result = await stkPush({
    phone,
    amount,
    accountReference: `SUB-${plan.toUpperCase()}`,
    transactionDesc: `PropDesk Africa ${planRow.name} subscription`,
  }).catch((e) => ({ error: e.message }))

  if ((result as any).error) {
    return errorResponse((result as any).error, 502)
  }

  const ok = (result as any).ResponseCode === "0"

  // Record the subscription payment intent
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const adminClient = url && serviceKey
    ? createClient(url, serviceKey, { auth: { persistSession: false } })
    : supabase

  const { data: tx, error: insErr } = await adminClient
    .from("subscription_payments")
    .insert({
      user_id: userId,
      plan_code: plan,
      amount,
      phone,
      checkout_request_id: (result as any).CheckoutRequestID,
      merchant_request_id: (result as any).MerchantRequestID,
      status: ok ? "initiated" : "failed",
      result_desc: (result as any).ResponseDescription,
    })
    .select()
    .single()

  if (insErr) {
    return successResponse({
      ...result,
      db_warning: insErr.message,
    })
  }

  return successResponse({
    checkout_request_id: (result as any).CheckoutRequestID,
    merchant_request_id: (result as any).MerchantRequestID,
    status: ok ? "initiated" : "failed",
    amount,
    plan,
    tx_id: tx?.id,
  })
})
