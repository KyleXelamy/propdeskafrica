import { withAuth, successResponse, errorResponse, pickFields, blankToNull, toNumberOrNull, HttpError } from "@/lib/api"
import type { NextRequest } from "next/server"

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

export const GET = withAuth(async (req: NextRequest, { supabase, userId }) => {
  const { searchParams } = new URL(req.url)
  const propertyId = searchParams.get("property_id")
  const tenantId = searchParams.get("tenant_id")
  const docType = searchParams.get("type")

  let query = supabase
    .from("documents")
    .select("*, properties(name, address), tenants(full_name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (propertyId) query = query.eq("property_id", propertyId)
  if (tenantId) query = query.eq("tenant_id", tenantId)
  if (docType) query = query.eq("type", docType)

  const { data, error } = await query
  if (error) return errorResponse(error.message, 500)
  return successResponse(data)
})

export const POST = withAuth(async (req: NextRequest, { supabase, userId }) => {
  const body = await req.json().catch(() => null)
  const fields = pickFields<Record<string, any>>(body, DOCUMENT_FIELDS)

  const name = blankToNull(fields.name) || blankToNull(fields.title)
  const type = blankToNull(fields.type) || blankToNull(fields.document_type)
  const fileUrl = blankToNull(fields.file_url)

  if (!name) throw new HttpError("Document name is required", 400)
  if (!type) throw new HttpError("Document type is required", 400)
  if (!fileUrl) throw new HttpError("file_url is required (upload to Supabase Storage first)", 400)

  const insert = {
    user_id: userId,
    name,
    type,
    file_url: fileUrl,
    file_size: toNumberOrNull(fields.file_size),
    mime_type: blankToNull(fields.mime_type),
    property_id: blankToNull(fields.property_id),
    tenant_id: blankToNull(fields.tenant_id),
    notes: blankToNull(fields.notes),
    expiry_date: blankToNull(fields.expiry_date),
    reminder_days_before: fields.reminder_days_before !== undefined
      ? Math.max(0, Math.min(365, Number(fields.reminder_days_before) || 30))
      : 30,
  }

  const { data, error } = await supabase
    .from("documents")
    .insert([insert])
    .select("*, properties(name, address), tenants(full_name)")
    .single()

  if (error) return errorResponse(error.message, 500)
  return successResponse(data, 201)
})
