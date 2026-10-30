import { withAuth, successResponse, errorResponse, HttpError, dbError } from "@/lib/api"
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
 *     plan: 'pro' | null,
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
  await supabase.rpc("ensure_subscription", { p_user: userId }).catch(() => null)
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*, plans(name)")
    .eq("user_id", userId)
    .maybeSingle()
  if (error) return dbError("subscription", error, 500)
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
  const trialExpired = data.status === "trialing" && data.trial_ends_at && new Date(data.trial_ends_at) <= new Date()
  const effectiveReason = trialExpired ? "trial_ended" : data.status
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
    reason: effectiveReason,
  })
})

/**
 * PATCH /api/subscription
 * Body: { plan?: 'pro', cancel?: true }
 *
 * For now this just lets the user "switch plan" — it does NOT take payment.
 * The real flow is: user picks plan → STK Push via /api/mpesa/stkpush with
 * plan metadata → on success, update subscription here.
 */
export const PATCH = withAuth(async (req, { supabase, userId }) => {
  const body = await req.json().catch(() => ({})) as any
  if (body.cancel === true || body.reactivate === true) {
    const { data: current, error: currentError } = await supabase
      .from("subscriptions")
      .select("status, plan_code, current_period_end, trial_ends_at")
      .eq("user_id", userId)
      .single()
    if (currentError || !current) return errorResponse("Subscription not found", 404)

    if (body.cancel === true) {
      if (["canceled", "expired"].includes(current.status)) return successResponse(current)
      const { data, error } = await supabase
        .from("subscriptions")
        .update({ status: "canceled", canceled_at: new Date().toISOString(), cancel_at: current.current_period_end || new Date().toISOString() })
        .eq("user_id", userId)
        .select()
        .single()
      if (error) return errorResponse("Unable to cancel subscription", 500)
      await supabase.from("subscription_events").insert({ user_id: userId, event: "canceled", from_plan: current.plan_code, to_plan: current.plan_code, from_status: current.status, to_status: "canceled", reason: "user_request", actor: userId })
      return successResponse(data)
    }

    const nextStatus = current.current_period_end && new Date(current.current_period_end) > new Date() ? "active" : "trialing"
    const { data, error } = await supabase
      .from("subscriptions")
      .update({ status: nextStatus, canceled_at: null, cancel_at: null, trial_ends_at: nextStatus === "trialing" ? current.trial_ends_at : null })
      .eq("user_id", userId)
      .select()
      .single()
    if (error) return errorResponse("Unable to reactivate subscription", 500)
    await supabase.from("subscription_events").insert({ user_id: userId, event: "reactivated", from_plan: current.plan_code, to_plan: current.plan_code, from_status: current.status, to_status: nextStatus, reason: "user_request", actor: userId })
    return successResponse(data)
  }
  if (body.plan) {
    const valid = ["pro"]
    if (!valid.includes(body.plan)) throw new HttpError("Invalid plan", 400)
    const { data, error } = await supabase
      .from("subscriptions")
      .update({ plan_code: body.plan, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .select()
      .single()
    if (error) return dbError("subscription", error, 500)
    return successResponse(data)
  }
  throw new HttpError("Provide plan or cancel", 400)
})
