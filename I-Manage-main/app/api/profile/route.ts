import { withAuth, successResponse, errorResponse, blankToNull, HttpError } from "@/lib/api"
import type { NextRequest } from "next/server"

export const GET = withAuth(async (_req, { supabase, userId }) => {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .single()

  if (error && error.code !== "PGRST116") {
    return errorResponse(error.message, 500)
  }
  return successResponse(data || { user_id: userId })
})

export const PUT = withAuth(async (req: NextRequest, { supabase, userId }) => {
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== "object") {
    throw new HttpError("Invalid body", 400)
  }

  const fullName = blankToNull(body.full_name) as string | null
  const update: Record<string, any> = {
    user_id: userId,
    full_name: fullName,
    first_name: fullName ? fullName.split(" ")[0] : null,
    last_name: fullName
      ? fullName.split(" ").slice(1).join(" ") || null
      : null,
    company_name: blankToNull(body.company_name),
    phone: blankToNull(body.phone),
    address: blankToNull(body.address),
    city: blankToNull(body.city),
    county: blankToNull(body.county),
    timezone: blankToNull(body.timezone) || "Africa/Nairobi",
    currency: blankToNull(body.currency) || "KES",
    date_format: blankToNull(body.date_format) || "DD/MM/YYYY",
    notification_preferences: body.notification_preferences || null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .upsert(update)
    .select()
    .single()

  if (error) return errorResponse(error.message, 500)
  return successResponse(data)
})
