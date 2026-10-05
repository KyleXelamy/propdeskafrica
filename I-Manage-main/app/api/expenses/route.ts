import { withAuth, successResponse, errorResponse, pickFields, blankToNull, toNumberOrNull, toBool, HttpError } from "@/lib/api"
import type { NextRequest } from "next/server"

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
  "notes",
] as const

export const GET = withAuth(async (_req, { supabase, userId }) => {
  const { searchParams } = new URL(_req.url)
  const propertyId = searchParams.get("property_id")
  const month = searchParams.get("month") // YYYY-MM
  const year = searchParams.get("year")

  let query = supabase
    .from("expenses")
    .select("*, properties(name, address)")
    .eq("user_id", userId)
    .order("expense_date", { ascending: false })

  if (propertyId) query = query.eq("property_id", propertyId)
  if (month) {
    const [y, m] = month.split("-").map(Number)
    if (y && m) {
      const start = new Date(Date.UTC(y, m - 1, 1)).toISOString()
      const end = new Date(Date.UTC(y, m, 0, 23, 59, 59)).toISOString()
      query = query.gte("expense_date", start).lte("expense_date", end)
    }
  } else if (year) {
    const start = new Date(Date.UTC(Number(year), 0, 1)).toISOString()
    const end = new Date(Date.UTC(Number(year), 11, 31, 23, 59, 59)).toISOString()
    query = query.gte("expense_date", start).lte("expense_date", end)
  }

  const { data, error } = await query
  if (error) return errorResponse(error.message, 500)
  return successResponse(data)
})

export const POST = withAuth(async (req: NextRequest, { supabase, userId }) => {
  const body = await req.json().catch(() => null)
  const fields = pickFields<Record<string, any>>(body, EXPENSE_FIELDS)

  if (!fields.description) throw new HttpError("description is required", 400)
  if (!fields.category) throw new HttpError("category is required", 400)
  if (!fields.expense_date) throw new HttpError("expense_date is required", 400)
  const amount = toNumberOrNull(fields.amount)
  if (amount === null) throw new HttpError("amount is required", 400)

  const insert = {
    ...fields,
    user_id: userId,
    amount,
    property_id: blankToNull(fields.property_id),
    vendor: blankToNull(fields.vendor),
    recurring_frequency: fields.is_recurring
      ? blankToNull(fields.recurring_frequency)
      : null,
    is_recurring: toBool(fields.is_recurring, false),
    notes: blankToNull(fields.notes),
  }

  const { data, error } = await supabase
    .from("expenses")
    .insert([insert])
    .select("*, properties(name, address)")
    .single()

  if (error) return errorResponse(error.message, 500)
  return successResponse(data, 201)
})
