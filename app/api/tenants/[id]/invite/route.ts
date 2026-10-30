import { withAuth, successResponse, errorResponse, HttpError, dbError } from "@/lib/api"

/**
 * POST /api/tenants/[id]/invite
 * Body: { email: string }
 *
 * "Invites" a tenant by linking an auth.users row to the tenant record.
 * For this to work, the tenant must already have an auth account matching
 * `email`. We don't actually send an email (that would need SMTP) — we
 * assume the tenant has already signed up via /auth/sign-up. Once linked,
 * the tenant can be onboarded and the landlord/agent can see the record in /dashboard.
 *
 * SECURITY: `tenant_users.user_id` is UNIQUE — one auth account maps to one
 * tenant portal link. The upsert used to conflict on `user_id` alone, so
 * inviting an account that was ALREADY linked to another landlord's tenant
 * silently REASSIGNED that link to the caller. Every link is now checked
 * against the caller's own tenants before it is written.
 */
export const POST = withAuth(async (req, { supabase, userId }, params) => {
  const body = await req.json().catch(() => null)
  const email = (body?.email || "").toString().trim().toLowerCase()
  if (!email) throw new HttpError("Provide tenant email", 400)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError("Invalid email", 400)

  // Confirm the tenant exists and the caller owns it
  const { data: tenant, error: tErr } = await supabase
    .from("tenants")
    .select("id, email, full_name, first_name, last_name, user_id")
    .eq("id", params.id)
    .eq("user_id", userId)
    .maybeSingle()
  if (tErr) return dbError("tenants/[id]/invite", tErr, 500)
  if (!tenant) throw new HttpError("Tenant not found", 404)

  // Resolve the auth user id from email via the admin API
  // (we need the service-role key for this)
  const { data: userList, error: lookupErr } = await supabase.auth.admin.listUsers()
  if (lookupErr) {
    return errorResponse("Cannot look up users — service role required", 500)
  }
  const matched = (userList?.users || []).find(
    (u: any) => (u.email || "").toLowerCase() === email,
  )
  if (!matched) {
    throw new HttpError(
      "No auth user with that email yet. Have the tenant sign up at /auth/sign-up first, then re-invite.",
      404,
    )
  }

  // If this auth account already has a portal link, it must be a link the
  // CALLER owns. Otherwise we would be taking another landlord's tenant
  // portal away from them.
  const { data: existingLink } = await supabase
    .from("tenant_users")
    .select("id, tenant_id")
    .eq("user_id", matched.id)
    .maybeSingle()

  if (existingLink && existingLink.tenant_id !== tenant.id) {
    const { data: existingTenant } = await supabase
      .from("tenants")
      .select("user_id")
      .eq("id", existingLink.tenant_id)
      .maybeSingle()

    if (!existingTenant || existingTenant.user_id !== userId) {
      throw new HttpError(
        "That email is already linked to another tenant record and cannot be re-invited here.",
        409,
      )
    }
  }

  // Create the link (or update if it is already this caller's own link)
  const { data, error } = await supabase
    .from("tenant_users")
    .upsert(
      {
        user_id: matched.id,
        tenant_id: tenant.id,
        invited_by: userId,
        invited_at: new Date().toISOString(),
        accepted_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select()
    .single()
  if (error) return dbError("tenants/[id]/invite", error, 500)
  return successResponse(data)
})

export const DELETE = withAuth(async (_req, { supabase, userId }, params) => {
  // Unlink a tenant from any auth user.
  // The tenant must belong to the caller, otherwise this endpoint could
  // unlink any landlord's tenant portal.
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", userId)
    .maybeSingle()
  if (!tenant) throw new HttpError("Tenant not found", 404)

  const { error } = await supabase
    .from("tenant_users")
    .delete()
    .eq("tenant_id", params.id)
  if (error) return dbError("tenants/[id]/invite", error, 500)
  return successResponse({ ok: true })
})
