import { withAuth, successResponse, errorResponse, pickFields, blankToNull, toNumberOrNull, HttpError } from "@/lib/api"

const MAINTENANCE_FIELDS = [
  "property_id",
  "tenant_id",
  "title",
  "description",
  "category",
  "priority",
  "status",
  "contractor_name",
  "contractor_phone",
  "estimated_cost",
  "actual_cost",
  "scheduled_date",
  "completed_date",
  "notes",
] as const

export const GET = withAuth(async (_req, { supabase, userId }, params) => {
  const { data, error } = await supabase
    .from("maintenance_requests")
    .select("*, properties(name, address), tenants(full_name)")
    .eq("id", params.id)
    .eq("user_id", userId)
    .single()

  if (error) return errorResponse("Maintenance request not found", 404)
  return successResponse(data)
})

export const PUT = withAuth(async (req, { supabase, userId }, params) => {
  const body = await req.json().catch(() => null)
  const fields = pickFields<Record<string, any>>(body, MAINTENANCE_FIELDS)

  if (Object.keys(fields).length === 0) {
    throw new HttpError("No fields to update", 400)
  }

  const update: Record<string, any> = { ...fields, updated_at: new Date().toISOString() }
  if (fields.estimated_cost !== undefined) update.estimated_cost = toNumberOrNull(fields.estimated_cost)
  if (fields.actual_cost !== undefined) update.actual_cost = toNumberOrNull(fields.actual_cost)
  if (fields.tenant_id !== undefined) update.tenant_id = blankToNull(fields.tenant_id)
  if (fields.scheduled_date !== undefined) update.scheduled_date = blankToNull(fields.scheduled_date)
  if (fields.completed_date !== undefined) update.completed_date = blankToNull(fields.completed_date)
  if (fields.contractor_name !== undefined) update.contractor_name = blankToNull(fields.contractor_name)
  if (fields.contractor_phone !== undefined) update.contractor_phone = blankToNull(fields.contractor_phone)
  if (fields.notes !== undefined) update.notes = blankToNull(fields.notes)

  const { data, error } = await supabase
    .from("maintenance_requests")
    .update(update)
    .eq("id", params.id)
    .eq("user_id", userId)
    .select("*, properties(name, address), tenants(full_name)")
    .single()

  if (error) return errorResponse(error.message, 500)
  if (!data) return errorResponse("Maintenance request not found", 404)
  return successResponse(data)
})

export const DELETE = withAuth(async (_req, { supabase, userId }, params) => {
  const { error, count } = await supabase
    .from("maintenance_requests")
    .delete({ count: "exact" })
    .eq("id", params.id)
    .eq("user_id", userId)

  if (error) return errorResponse(error.message, 500)
  if (!count) return errorResponse("Maintenance request not found", 404)
  return successResponse({ success: true })
})
