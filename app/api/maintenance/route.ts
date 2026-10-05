import { withAuth, successResponse, errorResponse, pickFields, blankToNull, toNumberOrNull, HttpError } from "@/lib/api"
import type { NextRequest } from "next/server"

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

export const GET = withAuth(async (req: NextRequest, { supabase, userId }) => {
  const { searchParams } = new URL(req.url)
  const propertyId = searchParams.get("property_id")
  const status = searchParams.get("status")
  const priority = searchParams.get("priority")

  let query = supabase
    .from("maintenance_requests")
    .select("*, properties(name, address), tenants(full_name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (propertyId) query = query.eq("property_id", propertyId)
  if (status) query = query.eq("status", status)
  if (priority) query = query.eq("priority", priority)

  const { data, error } = await query
  if (error) return errorResponse(error.message, 500)
  return successResponse(data)
})

export const POST = withAuth(async (req: NextRequest, { supabase, userId }) => {
  const body = await req.json().catch(() => null)
  const fields = pickFields<Record<string, any>>(body, MAINTENANCE_FIELDS)

  if (!blankToNull(fields.property_id)) throw new HttpError("property_id is required", 400)
  if (!blankToNull(fields.title)) throw new HttpError("title is required", 400)
  if (!blankToNull(fields.description)) throw new HttpError("description is required", 400)

  const insert = {
    ...fields,
    user_id: userId,
    tenant_id: blankToNull(fields.tenant_id),
    status: blankToNull(fields.status) || "open",
    priority: blankToNull(fields.priority) || "medium",
    category: blankToNull(fields.category) || "general",
    contractor_name: blankToNull(fields.contractor_name),
    contractor_phone: blankToNull(fields.contractor_phone),
    estimated_cost: toNumberOrNull(fields.estimated_cost),
    actual_cost: toNumberOrNull(fields.actual_cost),
    scheduled_date: blankToNull(fields.scheduled_date),
    completed_date: blankToNull(fields.completed_date),
    notes: blankToNull(fields.notes),
  }

  const { data, error } = await supabase
    .from("maintenance_requests")
    .insert([insert])
    .select("*, properties(name, address), tenants(full_name)")
    .single()

  if (error) return errorResponse(error.message, 500)
  return successResponse(data, 201)
})
