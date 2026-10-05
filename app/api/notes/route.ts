import { withAuth, successResponse, errorResponse, pickFields, blankToNull, toBool, HttpError } from "@/lib/api"
import type { NextRequest } from "next/server"

const NOTE_FIELDS = [
  "title",
  "content",
  "category",
  "property_id",
  "tenant_id",
  "priority",
  "is_pinned",
] as const

export const GET = withAuth(async (req: NextRequest, { supabase, userId }) => {
  const { searchParams } = new URL(req.url)
  const propertyId = searchParams.get("property_id")
  const tenantId = searchParams.get("tenant_id")

  let query = supabase
    .from("notes")
    .select("*, properties(name, address), tenants(full_name)")
    .eq("user_id", userId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })

  if (propertyId) query = query.eq("property_id", propertyId)
  if (tenantId) query = query.eq("tenant_id", tenantId)

  const { data, error } = await query
  if (error) return errorResponse(error.message, 500)
  return successResponse(data)
})

export const POST = withAuth(async (req: NextRequest, { supabase, userId }) => {
  const body = await req.json().catch(() => null)
  const fields = pickFields<Record<string, any>>(body, NOTE_FIELDS)

  if (!fields.content) throw new HttpError("content is required", 400)

  const insert = {
    title: blankToNull(fields.title) || "",
    content: fields.content,
    category: blankToNull(fields.category) || "general",
    priority: blankToNull(fields.priority) || "normal",
    property_id: blankToNull(fields.property_id),
    tenant_id: blankToNull(fields.tenant_id),
    is_pinned: toBool(fields.is_pinned, false),
    user_id: userId,
  }

  const { data, error } = await supabase
    .from("notes")
    .insert([insert])
    .select("*, properties(name, address), tenants(full_name)")
    .single()

  if (error) return errorResponse(error.message, 500)
  return successResponse(data, 201)
})
