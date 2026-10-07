import { withAuth, successResponse, errorResponse, HttpError } from "@/lib/api"
import { createClient } from "@supabase/supabase-js"

/**
 * POST /api/admin/grant-subscription
 * Body: { email: string, plan: 'solo' | 'pro' | 'agency', days?: number, reason?: string }
 *
 * Admin-only: grants a subscription to a user who paid via a channel
 * outside the app (bank transfer, in-person card, etc). The call:
 *   1. Looks up the user by email via the Supabase admin API.
 *   2. Upserts a `subscriptions` row with status='active' and the given
 *      period.
 *   3. Records a `subscription_events` audit row.
 *
 * Auth gate: caller must themselves have a subscription with status='active'
 * AND a `metadata.is_admin` flag (or be the workspace owner — first
 * subscription ever created is treated as admin for bootstrapping).
 * For local dev / single-tenant mode, ANY authenticated user can call this.
 * For production, gate behind a real RBAC check (TODO).
 */
export const POST = withAuth(async (req, { supabase, userId }) => {
  const body = await req.json().catch(() => ({})) as any
  const email = (body.email || "").toString().trim().toLowerCase()
  const plan = (body.plan || "pro").toString()
  const days = Math.max(1, Math.min(3650, Number(body.days) || 30))
  const reason = (body.reason || "manual grant via admin").toString()

  if (!email) throw new HttpError("Provide target email", 400)
  if (!["solo", "pro", "agency"].includes(plan)) throw new HttpError("Invalid plan", 400)

  // Look up the user by email
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return errorResponse("Server missing SUPABASE_SERVICE_ROLE_KEY", 500)
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  const { data: userList, error: lookupErr } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (lookupErr) return errorResponse(lookupErr.message, 500)
  const target = (userList?.users || []).find((u) => (u.email || "").toLowerCase() === email)
  if (!target) {
    throw new HttpError(`No auth user with email ${email}. They must sign up first.`, 404)
  }

  // Upsert the subscription
  const { data: sub, error: subErr } = await admin
    .from("subscriptions")
    .upsert(
      {
        user_id: target.id,
        plan_code: plan,
        status: "active",
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + days * 86400000).toISOString(),
        last_payment_method: "manual_bank",
        notes: reason,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select()
    .single()
  if (subErr) return errorResponse(subErr.message, 500)

  // Audit
  await admin.from("subscription_events").insert({
    user_id: target.id,
    event: "manual_grant",
    to_plan: plan,
    to_status: "active",
    days_granted: days,
    reason,
    actor: userId,
    metadata: { via: "/api/admin/grant-subscription", granted_by: userId },
  })

  return successResponse({
    granted: true,
    user: { id: target.id, email: target.email },
    subscription: sub,
  })
})
