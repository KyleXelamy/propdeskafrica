import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api"
import { stkPush } from "@/lib/mpesa/daraja"

const Schema = z.object({ paybill_id: z.string().uuid(), phone: z.string().trim().min(9).max(15), amount: z.coerce.number().int().min(1).max(100) })

export const POST = withAuth(async (request, { userId }) => {
  const parsed = Schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid phone number and amount between KES 1 and 100." }, { status: 400 })
  const { createServiceClient } = await import("@/lib/supabase/service")
  const supabase = createServiceClient()
  const { data: account } = await supabase.from("paybills").select("id, number, type").eq("id", parsed.data.paybill_id).eq("user_id", userId).eq("active", true).single()
  if (!account) return NextResponse.json({ error: "Payment account not found." }, { status: 404 })
  const { data: attempt, error } = await supabase.from("payment_test_attempts").insert({ user_id: userId, paybill_id: account.id, phone: parsed.data.phone, amount: parsed.data.amount, status: "pending" }).select("id").single()
  if (error || !attempt) return NextResponse.json({ error: "Could not create test payment." }, { status: 500 })
  try {
    const result = await stkPush({ phone: parsed.data.phone, amount: parsed.data.amount, accountReference: `TEST-${attempt.id.slice(0, 8)}`, transactionDesc: "Payment account test" })
    await supabase.from("payment_test_attempts").update({ provider_reference: result.CheckoutRequestID, status: "initiated" }).eq("id", attempt.id).eq("user_id", userId)
    return NextResponse.json({ ok: true, attempt_id: attempt.id, checkout_request_id: result.checkoutRequestId })
  } catch {
    await supabase.from("payment_test_attempts").update({ status: "failed" }).eq("id", attempt.id).eq("user_id", userId)
    return NextResponse.json({ error: "The test request could not be sent. Check the account configuration and try again." }, { status: 502 })
  }
})
