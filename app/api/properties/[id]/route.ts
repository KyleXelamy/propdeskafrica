import { withAuth, successResponse, errorResponse, pickFields, blankToNull, toNumberOrNull, HttpError } from "@/lib/api"

const PROPERTY_FIELDS = [
  "name",
  "address",
  "city",
  "county",
  "type",
  "property_type",
  "bedrooms",
  "bathrooms",
  "size_sqft",
  "square_feet",
  "rent_amount",
  "monthly_rent",
  "deposit_amount",
  "status",
  "description",
  "amenities",
] as const

export const GET = withAuth(async (_req, { supabase, userId }, params) => {
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", userId)
    .single()

  if (error) return errorResponse("Property not found", 404)
  return successResponse(data)
})

export const PUT = withAuth(async (req, { supabase, userId }, params) => {
  const body = await req.json().catch(() => null)
  const fields = pickFields<Record<string, any>>(body, PROPERTY_FIELDS)

  if (Object.keys(fields).length === 0) {
    throw new HttpError("No fields to update", 400)
  }

  const update: Record<string, any> = { ...fields, updated_at: new Date().toISOString() }
  if (fields.type !== undefined) update.type = blankToNull(fields.type)
  if (fields.property_type !== undefined && fields.type === undefined) {
    update.type = blankToNull(fields.property_type)
  }
  if (fields.rent_amount !== undefined) {
    const n = toNumberOrNull(fields.rent_amount)
    update.rent_amount = n
    update.monthly_rent = n
  }
  if (fields.monthly_rent !== undefined && fields.rent_amount === undefined) {
    const n = toNumberOrNull(fields.monthly_rent)
    update.rent_amount = n
    update.monthly_rent = n
  }
  if (fields.deposit_amount !== undefined) update.deposit_amount = toNumberOrNull(fields.deposit_amount)
  if (fields.bedrooms !== undefined) update.bedrooms = toNumberOrNull(fields.bedrooms)
  if (fields.bathrooms !== undefined) update.bathrooms = toNumberOrNull(fields.bathrooms)
  if (fields.size_sqft !== undefined) update.size_sqft = toNumberOrNull(fields.size_sqft)
  if (fields.square_feet !== undefined && fields.size_sqft === undefined) {
    update.size_sqft = toNumberOrNull(fields.square_feet)
  }
  if (fields.description !== undefined) update.description = blankToNull(fields.description)
  if (fields.amenities !== undefined && !Array.isArray(fields.amenities)) {
    update.amenities = []
  }

  const { data, error } = await supabase
    .from("properties")
    .update(update)
    .eq("id", params.id)
    .eq("user_id", userId)
    .select()
    .single()

  if (error) return errorResponse(error.message, 500)
  if (!data) return errorResponse("Property not found", 404)
  return successResponse(data)
})

export const DELETE = withAuth(async (_req, { supabase, userId }, params) => {
  const { error, count } = await supabase
    .from("properties")
    .delete({ count: "exact" })
    .eq("id", params.id)
    .eq("user_id", userId)

  if (error) return errorResponse(error.message, 500)
  if (!count) return errorResponse("Property not found", 404)
  return successResponse({ success: true })
})
