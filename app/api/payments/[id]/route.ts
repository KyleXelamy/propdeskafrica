import { withAuth, successResponse, errorResponse, pickFields, blankToNull, toNumberOrNull, HttpError } from "@/lib/api"

const PAYMENT_FIELDS = [
  "tenant_id",
  "property_id",
  "amount",
  "due_date",
  "paid_date",
  "payment_date",
  "payment_method",
  "status",
  "late_fee",
  "reference_number",
  "notes",
] as const

export const GET = withAuth(async (_req, { supabase, userId }, params) => {
  const { data, error } = await supabase
    .from("rent_payments")
    .select("*, tenants(full_name, email), properties(name, address)")
    .eq("id", params.id)
    .eq("user_id", userId)
    .single()

  if (error) return errorResponse("Payment not found", 404)
  return successResponse(data)
})

export const PUT = withAuth(async (req, { supabase, userId }, params) => {
  const body = await req.json().catch(() => null)
  const fields = pickFields<Record<string, any>>(body, PAYMENT_FIELDS)

  if (Object.keys(fields).length === 0) {
    throw new HttpError("No fields to update", 400)
  }

  const update: Record<string, any> = { ...fields }
  if (fields.amount !== undefined) update.amount = toNumberOrNull(fields.amount)
  if (fields.late_fee !== undefined) update.late_fee = toNumberOrNull(fields.late_fee) ?? 0
  if (fields.tenant_id !== undefined) update.tenant_id = blankToNull(fields.tenant_id)
  if (fields.property_id !== undefined) update.property_id = blankToNull(fields.property_id)
  if (fields.paid_date !== undefined) update.paid_date = blankToNull(fields.paid_date)
  if (fields.notes !== undefined) update.notes = blankToNull(fields.notes)

  const { data, error } = await supabase
    .from("rent_payments")
    .update(update)
    .eq("id", params.id)
    .eq("user_id", userId)
    .select("*, tenants(full_name, email), properties(name, address)")
    .single()

  if (error) return errorResponse(error.message, 500)
  if (!data) return errorResponse("Payment not found", 404)
  return successResponse(data)
})

export const DELETE = withAuth(async (_req, { supabase, userId }, params) => {
  const { error, count } = await supabase
    .from("rent_payments")
    .delete({ count: "exact" })
    .eq("id", params.id)
    .eq("user_id", userId)

  if (error) return errorResponse(error.message, 500)
  if (!count) return errorResponse("Payment not found", 404)
  return successResponse({ success: true })
})
