import { withAuth, successResponse, errorResponse, pickFields, blankToNull, toNumberOrNull, HttpError } from "@/lib/api"

const DOCUMENT_FIELDS = [
  "name",
  "title",
  "type",
  "document_type",
  "file_url",
  "file_size",
  "mime_type",
  "property_id",
  "tenant_id",
  "category",
  "notes",
  "expiry_date",
  "reminder_days_before",
] as const

export const GET = withAuth(async (_req, { supabase, userId }, params) => {
  const { data, error } = await supabase
    .from("documents")
    .select("*, properties(name, address), tenants(full_name)")
    .eq("id", params.id)
    .eq("user_id", userId)
    .single()

  if (error) return errorResponse("Document not found", 404)
  return successResponse(data)
})

export const PUT = withAuth(async (req, { supabase, userId }, params) => {
  const body = await req.json().catch(() => null)
  const fields = pickFields<Record<string, any>>(body, DOCUMENT_FIELDS)

  if (Object.keys(fields).length === 0) {
    throw new HttpError("No fields to update", 400)
  }

  const update: Record<string, any> = { ...fields }
  if (fields.title !== undefined && fields.name === undefined) {
    update.name = blankToNull(fields.title)
  }
  if (fields.document_type !== undefined && fields.type === undefined) {
    update.type = blankToNull(fields.document_type)
  }
  if (fields.property_id !== undefined) update.property_id = blankToNull(fields.property_id)
  if (fields.tenant_id !== undefined) update.tenant_id = blankToNull(fields.tenant_id)
  if (fields.notes !== undefined) update.notes = blankToNull(fields.notes)
  if (fields.file_size !== undefined) update.file_size = toNumberOrNull(fields.file_size)
  if (fields.expiry_date !== undefined) update.expiry_date = blankToNull(fields.expiry_date)
  if (fields.reminder_days_before !== undefined) {
    update.reminder_days_before = Math.max(0, Math.min(365, Number(fields.reminder_days_before) || 30))
  }

  const { data, error } = await supabase
    .from("documents")
    .update(update)
    .eq("id", params.id)
    .eq("user_id", userId)
    .select("*, properties(name, address), tenants(full_name)")
    .single()

  if (error) return errorResponse(error.message, 500)
  if (!data) return errorResponse("Document not found", 404)
  return successResponse(data)
})

export const DELETE = withAuth(async (_req, { supabase, userId }, params) => {
  // First fetch the row so we can clean up the Storage object afterwards.
  const { data: doc } = await supabase
    .from("documents")
    .select("file_url")
    .eq("id", params.id)
    .eq("user_id", userId)
    .single()

  if (!doc) return errorResponse("Document not found", 404)

  const { error, count } = await supabase
    .from("documents")
    .delete({ count: "exact" })
    .eq("id", params.id)
    .eq("user_id", userId)

  if (error) return errorResponse(error.message, 500)

  // Best-effort storage cleanup — ignore errors here.
  if (doc.file_url) {
    try {
      const path = extractStoragePath(doc.file_url)
      if (path) {
        await supabase.storage.from("documents").remove([path])
      }
    } catch (e) {
      console.warn("[api] storage cleanup failed", e)
    }
  }

  return successResponse({ success: true, deleted: count })
})

/** Extracts the object path from a Supabase public URL. */
function extractStoragePath(publicUrl: string): string | null {
  try {
    const u = new URL(publicUrl)
    const marker = "/storage/v1/object/public/documents/"
    const idx = u.pathname.indexOf(marker)
    if (idx === -1) return null
    return decodeURIComponent(u.pathname.slice(idx + marker.length))
  } catch {
    return null
  }
}
