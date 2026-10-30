import { withAuth, successResponse, errorResponse, pickFields, blankToNull, toNumberOrNull, HttpError, dbError } from "@/lib/api"
import type { NextRequest } from "next/server"

const PAYMENT_FIELDS = [
  "tenant_id",
  "property_id",
  "amount",
  "due_date",
  "paid_date",
  "payment_date",
  "payment_method",
  "status",
  "late_fee",
  "reference_number",
  "notes",
] as const

export const GET = withAuth(async (req: NextRequest, { supabase, userId }) => {
  const { searchParams } = new URL(req.url)
  const tenantId = searchParams.get("tenant_id")
  const propertyId = searchParams.get("property_id")
  const status = searchParams.get("status")
  const month = searchParams.get("month")
  const year = searchParams.get("year")

  let query = supabase
    .from("rent_payments")
    .select("*, tenants(full_name, email), properties(name, address)")
    .eq("user_id", userId)
    .order("payment_date", { ascending: false })

  if (tenantId) query = query.eq("tenant_id", tenantId)
  if (propertyId) query = query.eq("property_id", propertyId)
  if (status) query = query.eq("status", status)

  if (month) {
    const [y, m] = month.split("-").map(Number)
    if (y && m) {
      const start = new Date(Date.UTC(y, m - 1, 1)).toISOString()
      const end = new Date(Date.UTC(y, m, 0, 23, 59, 59)).toISOString()
      query = query.gte("due_date", start).lte("due_date", end)
    }
  } else if (year) {
    const start = new Date(Date.UTC(Number(year), 0, 1)).toISOString()
    const end = new Date(Date.UTC(Number(year), 11, 31, 23, 59, 59)).toISOString()
    query = query.gte("due_date", start).lte("due_date", end)
  }

  const { data, error } = await query
  if (error) return dbError("payments", error, 500)
  return successResponse(data)
})

export const POST = withAuth(async (req: NextRequest, { supabase, userId }) => {
  const body = await req.json().catch(() => null)
  const fields = pickFields<Record<string, any>>(body, PAYMENT_FIELDS)

  const amount = toNumberOrNull(fields.amount)
  if (amount === null) throw new HttpError("amount is required", 400)
  if (!blankToNull(fields.tenant_id)) throw new HttpError("tenant_id is required", 400)
  if (!blankToNull(fields.property_id)) throw new HttpError("property_id is required", 400)

  // Every referenced row must belong to the caller. Without this check a
  // landlord could file a payment against another landlord's property or
  // tenant by id.
  const propertyId = blankToNull(fields.property_id) as string
  const tenantId = blankToNull(fields.tenant_id) as string

  const { data: property } = await supabase
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .eq("user_id", userId)
    .maybeSingle()
  if (!property) throw new HttpError("Property not found", 404)

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("id", tenantId)
    .eq("user_id", userId)
    .maybeSingle()
  if (!tenant) throw new HttpError("Tenant not found", 404)

  // Auto-fill payment_date from paid_date if not provided
  const insert = {
    ...fields,
    user_id: userId,
    amount,
    late_fee: toNumberOrNull(fields.late_fee) ?? 0,
    payment_date: blankToNull(fields.payment_date) || blankToNull(fields.paid_date) || new Date().toISOString(),
    paid_date: blankToNull(fields.paid_date) || blankToNull(fields.payment_date),
    due_date: blankToNull(fields.due_date),
    status: blankToNull(fields.status) || "pending",
    payment_method: blankToNull(fields.payment_method) || "cash",
    notes: blankToNull(fields.notes),
  }

  const { data, error } = await supabase
    .from("rent_payments")
    .insert([insert])
    .select("*, tenants(full_name, email), properties(name, address)")
    .single()

  if (error) return dbError("payments", error, 500)
  return successResponse(data, 201)
})
