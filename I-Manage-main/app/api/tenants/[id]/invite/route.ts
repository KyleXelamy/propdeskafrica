import { withAuth, successResponse, errorResponse, HttpError } from "@/lib/api"

/**
 * POST /api/tenants/[id]/invite
 * Body: { email: string }
 *
 * "Invites" a tenant by linking an auth.users row to the tenant record.
 * For this to work, the tenant must already have an auth account matching
 * `email`. We don't actually send an email (that would need SMTP) — we
 * assume the tenant has already signed up via /auth/sign-up. Once linked,
 * the tenant can be onboarded and the landlord/agent can see the record in /dashboard.
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
  if (tErr) return errorResponse(tErr.message, 500)
  if (!tenant) throw new HttpError("Tenant not found", 404)

  // Resolve the auth user id from email via the admin API
  // (we need the service-role key for this)
  const { data: userList, error: lookupErr } = await supabase.auth.admin.listUsers()
  if (lookupErr) {
    return errorResponse("Cannot look up users — service role required", 500)
  }
  const matched = (userList?.users || []).find(
    (u) => (u.email || "").toLowerCase() === email,
  )
  if (!matched) {
    throw new HttpError(
      "No auth user with that email yet. Have the tenant sign up at /auth/sign-up first, then re-invite.",
      404,
    )
  }

  // Create the link (or update if existing)
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
  if (error) return errorResponse(error.message, 500)
  return successResponse(data)
})

export const DELETE = withAuth(async (_req, { supabase, userId }, params) => {
  // Unlink a tenant from any auth user.
  const { error } = await supabase
    .from("tenant_users")
    .delete()
    .eq("tenant_id", params.id)
  if (error) return errorResponse(error.message, 500)
  return successResponse({ ok: true })
})
