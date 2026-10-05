import { withAuth, successResponse, errorResponse, pickFields, blankToNull, toNumberOrNull, HttpError } from "@/lib/api"

const TENANT_FIELDS = [
  "full_name",
  "first_name",
  "last_name",
  "email",
  "phone",
  "national_id",
  "id_number",
  "property_id",
  "emergency_contact_name",
  "emergency_contact_phone",
  "lease_start_date",
  "lease_end_date",
  "monthly_rent",
  "deposit_amount",
  "deposit_paid",
  "status",
  "notes",
] as const

export const GET = withAuth(async (_req, { supabase, userId }, params) => {
  const { data, error } = await supabase
    .from("tenants")
    .select("*, properties(name, address)")
    .eq("id", params.id)
    .eq("user_id", userId)
    .single()

  if (error) return errorResponse("Tenant not found", 404)
  return successResponse(data)
})

export const PUT = withAuth(async (req, { supabase, userId }, params) => {
  const body = await req.json().catch(() => null)
  const fields = pickFields<Record<string, any>>(body, TENANT_FIELDS)

  if (Object.keys(fields).length === 0) {
    throw new HttpError("No fields to update", 400)
  }

  const update: Record<string, any> = { ...fields, updated_at: new Date().toISOString() }

  // Recompute full_name if any of the name components changed.
  if (fields.first_name !== undefined || fields.last_name !== undefined || fields.full_name !== undefined) {
    const firstName = blankToNull(fields.first_name) as string | null
    const lastName = blankToNull(fields.last_name) as string | null
    const provided = blankToNull(fields.full_name) as string | null
    const merged = provided || [firstName, lastName].filter(Boolean).join(" ") || null
    if (merged) update.full_name = merged
  }

  if (fields.property_id !== undefined) update.property_id = blankToNull(fields.property_id)
  if (fields.email !== undefined) update.email = blankToNull(fields.email)
  if (fields.national_id !== undefined || fields.id_number !== undefined) {
    update.national_id = blankToNull(fields.national_id) || blankToNull(fields.id_number)
  }
  if (fields.emergency_contact_name !== undefined) update.emergency_contact_name = blankToNull(fields.emergency_contact_name)
  if (fields.emergency_contact_phone !== undefined) update.emergency_contact_phone = blankToNull(fields.emergency_contact_phone)
  if (fields.lease_start_date !== undefined) update.lease_start_date = blankToNull(fields.lease_start_date)
  if (fields.lease_end_date !== undefined) update.lease_end_date = blankToNull(fields.lease_end_date)
  if (fields.monthly_rent !== undefined) update.monthly_rent = toNumberOrNull(fields.monthly_rent)
  if (fields.deposit_amount !== undefined) update.deposit_amount = toNumberOrNull(fields.deposit_amount)
  if (fields.notes !== undefined) update.notes = blankToNull(fields.notes)

  const { data, error } = await supabase
    .from("tenants")
    .update(update)
    .eq("id", params.id)
    .eq("user_id", userId)
    .select("*, properties(name, address)")
    .single()

  if (error) return errorResponse(error.message, 500)
  if (!data) return errorResponse("Tenant not found", 404)
  return successResponse(data)
})

export const DELETE = withAuth(async (_req, { supabase, userId }, params) => {
  const { error, count } = await supabase
    .from("tenants")
    .delete({ count: "exact" })
    .eq("id", params.id)
    .eq("user_id", userId)

  if (error) return errorResponse(error.message, 500)
  if (!count) return errorResponse("Tenant not found", 404)
  return successResponse({ success: true })
})
