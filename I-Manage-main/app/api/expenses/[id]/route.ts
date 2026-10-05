import { withAuth, successResponse, errorResponse, pickFields, blankToNull, toNumberOrNull, toBool, HttpError } from "@/lib/api"

const EXPENSE_FIELDS = [
  "property_id",
  "category",
  "amount",
  "description",
  "expense_date",
  "receipt_url",
  "vendor",
  "is_recurring",
  "recurring_frequency",
  "next_occurrence",
  "notes",
] as const

export const GET = withAuth(async (_req, { supabase, userId }, params) => {
  const { data, error } = await supabase
    .from("expenses")
    .select("*, properties(name, address)")
    .eq("id", params.id)
    .eq("user_id", userId)
    .single()

  if (error) return errorResponse("Expense not found", 404)
  return successResponse(data)
})

export const PUT = withAuth(async (req, { supabase, userId }, params) => {
  const body = await req.json().catch(() => null)
  const fields = pickFields<Record<string, any>>(body, EXPENSE_FIELDS)

  if (Object.keys(fields).length === 0) {
    throw new HttpError("No fields to update", 400)
  }

  const update: Record<string, any> = { ...fields, updated_at: new Date().toISOString() }
  if (fields.amount !== undefined) update.amount = toNumberOrNull(fields.amount)
  if (fields.property_id !== undefined) update.property_id = blankToNull(fields.property_id)
  if (fields.is_recurring !== undefined) update.is_recurring = toBool(fields.is_recurring, false)
  if (fields.is_recurring === false) update.recurring_frequency = null
  if (fields.next_occurrence !== undefined) update.next_occurrence = blankToNull(fields.next_occurrence)
  if (fields.vendor !== undefined) update.vendor = blankToNull(fields.vendor)
  if (fields.notes !== undefined) update.notes = blankToNull(fields.notes)

  const { data, error } = await supabase
    .from("expenses")
    .update(update)
    .eq("id", params.id)
    .eq("user_id", userId)
    .select("*, properties(name, address)")
    .single()

  if (error) return errorResponse(error.message, 500)
  if (!data) return errorResponse("Expense not found", 404)
  return successResponse(data)
})

export const DELETE = withAuth(async (_req, { supabase, userId }, params) => {
  const { error, count } = await supabase
    .from("expenses")
    .delete({ count: "exact" })
    .eq("id", params.id)
    .eq("user_id", userId)

  if (error) return errorResponse(error.message, 500)
  if (!count) return errorResponse("Expense not found", 404)
  return successResponse({ success: true })
})
