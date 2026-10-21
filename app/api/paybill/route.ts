import { NextResponse, type NextRequest } from "next/server"
import { withAuth } from "@/lib/api"
import { z } from "zod"

/**
 * /api/paybill
 * GET  — list configured paybills / tills
 * POST — register a new paybill / till
 */

const Type = z.enum(["paybill", "till"])

const CreateSchema = z.object({
  label: z.string().trim().min(1).max(80),
  number: z.string().trim().min(3).max(20),
  type: Type,
  property_ids: z.array(z.string().uuid()).min(1).max(50),
  c2b_validation_url: z.string().url().optional(),
}).superRefine((value, context) => {
  const digits = value.number.replace(/\\s+/g, "")
  const valid = value.type === "till" ? /^\\d{6}$/.test(digits) : /^\\d{5,7}$/.test(digits)
  if (!valid) context.addIssue({ code: z.ZodIssueCode.custom, path: ["number"], message: value.type === "till" ? "Enter a 6-digit Till number." : "Enter a 5–7 digit business number." })
})

export const runtime = "nodejs"

export const GET = withAuth(async (_request, { userId }) => {
  const { createServiceClient } = await import("@/lib/supabase/service")
  const supabase = createServiceClient()
  const { data, error } = await supabase.from("paybills").select("id, label, number, type, active, created_at").eq("user_id", userId).order("created_at", { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ count: data?.length ?? 0, paybills: data ?? [] })
})

export const POST = withAuth(async (request, { userId }) => {
  const json = await request.json().catch(() => null)
  const parsed = CreateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    )
  }

  const number = parsed.data.number.replace(/\s+/g, "")
  const validNumber = parsed.data.type === "till" ? /^\d{6}$/.test(number) : /^\d{5,7}$/.test(number)
  if (!validNumber) return NextResponse.json({ error: parsed.data.type === "till" ? "Enter a 6-digit Till number." : "Enter a 5–7 digit business number." }, { status: 400 })
  const { createServiceClient } = await import("@/lib/supabase/service")
  const supabase = createServiceClient()
  const { data: account, error } = await supabase.from("paybills").insert({ user_id: userId, label: parsed.data.label, number, type: parsed.data.type, c2b_validation_url: parsed.data.c2b_validation_url || null }).select("id, label, number, type, active, created_at").single()
  if (error?.code === "23505") return NextResponse.json({ error: "That account is already configured." }, { status: 409 })
  if (error) return NextResponse.json({ error: "Could not save this payment account." }, { status: 500 })
  const { data: properties } = await supabase.from("properties").select("id").eq("user_id", userId).in("id", parsed.data.property_ids)
  if ((properties || []).length !== parsed.data.property_ids.length) {
    await supabase.from("paybills").delete().eq("id", account.id).eq("user_id", userId)
    return NextResponse.json({ error: "One or more selected properties are not available." }, { status: 400 })
  }
  const { error: linkError } = await supabase.from("paybill_properties").insert(parsed.data.property_ids.map((property_id) => ({ paybill_id: account.id, property_id, user_id: userId })))
  if (linkError) return NextResponse.json({ error: "Account saved, but property assignment failed." }, { status: 500 })
  return NextResponse.json({ ok: true, paybill: account, message: "Payment account saved. Connect its Daraja callback before going live." }, { status: 201 })
})

void Type
