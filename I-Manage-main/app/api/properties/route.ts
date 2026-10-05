import { withAuth, successResponse, errorResponse, pickFields, blankToNull, toNumberOrNull, HttpError } from "@/lib/api"
import type { NextRequest } from "next/server"

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

export const GET = withAuth(async (req: NextRequest, { supabase, userId }) => {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")
  const type = searchParams.get("type")

  let query = supabase
    .from("properties")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (status) query = query.eq("status", status)
  if (type) query = query.eq("type", type)

  const { data, error } = await query
  if (error) return errorResponse(error.message, 500)
  return successResponse(data)
})

export const POST = withAuth(async (req: NextRequest, { supabase, userId }) => {
  const body = await req.json().catch(() => null)
  const fields = pickFields<Record<string, any>>(body, PROPERTY_FIELDS)

  if (!fields.name) throw new HttpError("name is required", 400)
  if (!fields.address) throw new HttpError("address is required", 400)
  if (!fields.city) throw new HttpError("city is required", 400)
  if (!fields.county) throw new HttpError("county is required", 400)

  const type = blankToNull(fields.type) || blankToNull(fields.property_type)
  if (!type) throw new HttpError("type is required", 400)

  const rent = toNumberOrNull(fields.rent_amount) ?? toNumberOrNull(fields.monthly_rent)
  if (rent === null) throw new HttpError("rent_amount is required", 400)

  const insert: Record<string, any> = {
    user_id: userId,
    name: fields.name,
    address: fields.address,
    city: fields.city,
    county: fields.county,
    type,
    status: blankToNull(fields.status) || "available",
    description: blankToNull(fields.description),
    rent_amount: rent,
    monthly_rent: rent,
    deposit_amount: toNumberOrNull(fields.deposit_amount),
    bedrooms: toNumberOrNull(fields.bedrooms),
    bathrooms: toNumberOrNull(fields.bathrooms),
    size_sqft: toNumberOrNull(fields.size_sqft) ?? toNumberOrNull(fields.square_feet),
    square_feet: toNumberOrNull(fields.square_feet) ?? toNumberOrNull(fields.size_sqft),
    amenities: Array.isArray(fields.amenities) ? fields.amenities : [],
  }

  const { data, error } = await supabase
    .from("properties")
    .insert([insert])
    .select()
    .single()

  if (error) return errorResponse(error.message, 500)
  return successResponse(data, 201)
})
