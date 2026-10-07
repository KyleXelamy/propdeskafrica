import { withAuth, successResponse, errorResponse, HttpError } from "@/lib/api"
import { getDb, neonConfigured } from "@/lib/db/neon"
import { createClient } from "@/lib/supabase/server"

/**
 * GET /api/subscription
 * Returns the current user's subscription state. Auto-creates a 14-day
 * trial row on first call so middleware doesn't have to.
 *
 * Response shape:
 *   {
 *     has_subscription: boolean,
 *     is_active: boolean,           // false if trial expired or canceled
 *     is_trialing: boolean,
 *     trial_expired: boolean,
 *     days_left: number,
 *     plan: 'solo' | 'pro' | 'agency' | null,
 *     plan_name: string | null,
 *     reason: 'no_subscription' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired' | 'trial_ended'
 *   }
 */
export const GET = withAuth(async (_req, { supabase, userId }) => {
  // Try Neon first, fall back to Supabase
  if (neonConfigured()) {
    const sql = getDb()
    // Ensure row exists
    await sql`select public.ensure_subscription(${userId}::uuid)`.catch(() => null)
    const rows = await sql`select * from public.subscription_status(${userId}::uuid)` as any[]
    const status = rows?.[0]?.subscription_status || rows?.[0] || null
    if (!status) {
      return successResponse({
        has_subscription: false,
        is_active: false,
        is_trialing: false,
        trial_expired: false,
        days_left: 0,
        plan: null,
        plan_name: null,
        reason: "no_subscription",
      })
    }
    // Pretty plan name
    let planName: string | null = null
    if (status.plan) {
      const p = await sql`select name from public.plans where code = ${status.plan}`
      planName = p?.[0]?.name || null
    }
    return successResponse({ ...status, plan_name: planName })
  }
  // Supabase fallback
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*, plans(name)")
    .eq("user_id", userId)
    .maybeSingle()
  if (error) return errorResponse(error.message, 500)
  if (!data) {
    return successResponse({
      has_subscription: false,
      is_active: false,
      is_trialing: false,
      trial_expired: false,
      days_left: 0,
      plan: null,
      plan_name: null,
      reason: "no_subscription",
    })
  }
  const trialExpired = data.status === "trialing" && data.trial_ends_at && new Date(data.trial_ends_at) < new Date()
  const isActive = !trialExpired && !["canceled", "expired", "past_due"].includes(data.status)
  const daysLeft = isActive
    ? Math.max(0, Math.ceil(
        (new Date(data.current_period_end || data.trial_ends_at).getTime() - Date.now()) / 86400000
      ))
    : 0
  return successResponse({
    has_subscription: true,
    is_active: isActive,
    is_trialing: data.status === "trialing",
    trial_expired: trialExpired,
    days_left: daysLeft,
    plan: data.plan_code,
    plan_name: (data as any).plans?.name || null,
    reason: trialExpired ? "trial_ended" : data.status,
  })
})

/**
 * PATCH /api/subscription
 * Body: { plan?: 'solo' | 'pro' | 'agency', cancel?: true }
 *
 * For now this just lets the user "switch plan" — it does NOT take payment.
 * The real flow is: user picks plan → STK Push via /api/mpesa/stkpush with
 * plan metadata → on success, update subscription here.
 */
export const PATCH = withAuth(async (req, { supabase, userId }) => {
  const body = await req.json().catch(() => ({})) as any
  if (body.cancel === true) {
    const { data, error } = await supabase
      .from("subscriptions")
      .update({ status: "canceled", canceled_at: new Date().toISOString() })
      .eq("user_id", userId)
      .select()
      .single()
    if (error) return errorResponse(error.message, 500)
    return successResponse(data)
  }
  if (body.plan) {
    const valid = ["solo", "pro", "agency"]
    if (!valid.includes(body.plan)) throw new HttpError("Invalid plan", 400)
    const { data, error } = await supabase
      .from("subscriptions")
      .update({ plan_code: body.plan, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .select()
      .single()
    if (error) return errorResponse(error.message, 500)
    return successResponse(data)
  }
  throw new HttpError("Provide plan or cancel", 400)
})
