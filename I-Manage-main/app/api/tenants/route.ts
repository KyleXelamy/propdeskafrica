import { withAuth, successResponse, errorResponse, pickFields, blankToNull, toNumberOrNull, HttpError } from "@/lib/api"
import type { NextRequest } from "next/server"

const TENANT_FIELDS = [
  "full_name",
  "first_name",
  "last_name",
  "email",
  "phone",
  "national_id",
  "id_number",
  "property_id",
  "emergency_contact_name",
  "emergency_contact_phone",
  "lease_start_date",
  "lease_end_date",
  "monthly_rent",
  "deposit_amount",
  "deposit_paid",
  "status",
  "notes",
] as const

export const GET = withAuth(async (req: NextRequest, { supabase, userId }) => {
  const { searchParams } = new URL(req.url)
  const propertyId = searchParams.get("property_id")
  const status = searchParams.get("status")

  let query = supabase
    .from("tenants")
    .select("*, properties(name, address)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (propertyId) query = query.eq("property_id", propertyId)
  if (status) query = query.eq("status", status)

  const { data, error } = await query
  if (error) return errorResponse(error.message, 500)
  return successResponse(data)
})

export const POST = withAuth(async (req: NextRequest, { supabase, userId }) => {
  const body = await req.json().catch(() => null)
  const fields = pickFields<Record<string, any>>(body, TENANT_FIELDS)

  // Normalise the name — accept either full_name OR first_name+last_name.
  const firstName = blankToNull(fields.first_name) as string | null
  const lastName = blankToNull(fields.last_name) as string | null
  const fullName =
    (blankToNull(fields.full_name) as string | null) ||
    [firstName, lastName].filter(Boolean).join(" ") ||
    null

  if (!fullName) throw new HttpError("full_name is required (or first_name + last_name)", 400)
  if (!fields.phone) throw new HttpError("phone is required", 400)

  const insert: Record<string, any> = {
    user_id: userId,
    full_name: fullName,
    first_name: firstName,
    last_name: lastName,
    email: blankToNull(fields.email),
    phone: fields.phone,
    national_id: blankToNull(fields.national_id) || blankToNull(fields.id_number),
    property_id: blankToNull(fields.property_id),
    emergency_contact_name: blankToNull(fields.emergency_contact_name),
    emergency_contact_phone: blankToNull(fields.emergency_contact_phone),
    lease_start_date: blankToNull(fields.lease_start_date),
    lease_end_date: blankToNull(fields.lease_end_date),
    monthly_rent:
      toNumberOrNull(fields.monthly_rent) ?? toNumberOrNull(fields.deposit_paid),
    deposit_amount: toNumberOrNull(fields.deposit_amount),
    status: blankToNull(fields.status) || "active",
    notes: blankToNull(fields.notes),
  }

  const { data, error } = await supabase
    .from("tenants")
    .insert([insert])
    .select("*, properties(name, address)")
    .single()

  if (error) return errorResponse(error.message, 500)
  return successResponse(data, 201)
})
