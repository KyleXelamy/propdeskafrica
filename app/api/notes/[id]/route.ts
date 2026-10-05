import { withAuth, successResponse, errorResponse, pickFields, blankToNull, toBool, HttpError } from "@/lib/api"

const NOTE_FIELDS = [
  "title",
  "content",
  "category",
  "property_id",
  "tenant_id",
  "priority",
  "is_pinned",
] as const

export const GET = withAuth(async (_req, { supabase, userId }, params) => {
  const { data, error } = await supabase
    .from("notes")
    .select("*, properties(name, address), tenants(full_name)")
    .eq("id", params.id)
    .eq("user_id", userId)
    .single()

  if (error) return errorResponse("Note not found", 404)
  return successResponse(data)
})

export const PUT = withAuth(async (req, { supabase, userId }, params) => {
  const body = await req.json().catch(() => null)
  const fields = pickFields<Record<string, any>>(body, NOTE_FIELDS)

  if (Object.keys(fields).length === 0) {
    throw new HttpError("No fields to update", 400)
  }

  const update: Record<string, any> = { ...fields, updated_at: new Date().toISOString() }
  if (fields.property_id !== undefined) update.property_id = blankToNull(fields.property_id)
  if (fields.tenant_id !== undefined) update.tenant_id = blankToNull(fields.tenant_id)
  if (fields.is_pinned !== undefined) update.is_pinned = toBool(fields.is_pinned, false)

  const { data, error } = await supabase
    .from("notes")
    .update(update)
    .eq("id", params.id)
    .eq("user_id", userId)
    .select("*, properties(name, address), tenants(full_name)")
    .single()

  if (error) return errorResponse(error.message, 500)
  if (!data) return errorResponse("Note not found", 404)
  return successResponse(data)
})

export const DELETE = withAuth(async (_req, { supabase, userId }, params) => {
  const { error, count } = await supabase
    .from("notes")
    .delete({ count: "exact" })
    .eq("id", params.id)
    .eq("user_id", userId)

  if (error) return errorResponse(error.message, 500)
  if (!count) return errorResponse("Note not found", 404)
  return successResponse({ success: true })
})
