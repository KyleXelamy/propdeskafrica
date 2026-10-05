import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { isFromSafaricom } from "@/lib/mpesa/daraja"

/**
 * POST /api/mpesa/callback
 * Public endpoint hit by Safaricom when an STK push settles.
 *
 * Daraja's payload shape:
 * {
 *   Body: {
 *     stkCallback: {
 *       MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc,
 *       CallbackMetadata: { Item: [
 *         { Name: "Amount", Value: 12345 },
 *         { Name: "MpesaReceiptNumber", Value: "..." },
 *         { Name: "TransactionDate", Value: 20240101120000 },
 *         { Name: "PhoneNumber", Value: 2547XXXXXXXX }
 *       ]}
 *     }
 *   }
 * }
 */
export async function POST(req: NextRequest) {
  // Public endpoint — we DO NOT use withAuth here. We rely on:
  //   1. The configured callback URL being hard-to-guess (env var), and
  //   2. Optional IP allowlist (MPESA_ALLOWED_CALLBACK_IPS).
  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || null
  if (!isFromSafaricom(forwardedFor)) {
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Rejected" }, { status: 403 })
  }

  const body = await req.json().catch(() => null) as any
  const stk = body?.Body?.stkCallback
  if (!stk) {
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Bad payload" }, { status: 400 })
  }
  const checkoutId: string = stk.CheckoutRequestID
  const merchantId: string = stk.MerchantRequestID
  const resultCode: number = Number(stk.ResultCode)
  const resultDesc: string = stk.ResultDesc || ""

  // Pull the metadata
  const items: any[] = stk.CallbackMetadata?.Item || []
  const meta: Record<string, any> = {}
  for (const it of items) meta[it.Name] = it.Value

  const status = resultCode === 0 ? "completed" : "failed"

  // We need a service-role client to look up + update the row in a public
  // endpoint. Fall back to the authless client if not configured (best-effort).
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Server misconfigured" }, { status: 500 })
  }
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

  const update = {
    status,
    result_code: resultCode,
    result_desc: resultDesc,
    mpesa_receipt: meta.MpesaReceiptNumber || null,
    transaction_date: meta.TransactionDate ? String(meta.TransactionDate) : null,
    completed_at: status === "completed" ? new Date().toISOString() : null,
    raw_callback: body,
  }
  const { data: tx, error: txErr } = await supabase
    .from("mpesa_transactions")
    .update(update)
    .eq("checkout_request_id", checkoutId)
    .select("id, user_id, tenant_id, payment_id, amount")
    .maybeSingle()

  if (txErr) {
    return NextResponse.json({ ResultCode: 1, ResultDesc: "DB error" }, { status: 500 })
  }

  // If the push succeeded AND the original rent_payments row is marked
  // pending, mark it paid. This is the "magic" — tenant pays via M-Pesa,
  // their rent balance updates automatically.
  if (status === "completed" && tx?.payment_id) {
    await supabase
      .from("rent_payments")
      .update({
        status: "paid",
        paid_date: new Date().toISOString().slice(0, 10),
        payment_method: "mpesa",
        reference_number: meta.MpesaReceiptNumber || null,
      })
      .eq("id", tx.payment_id)
      .eq("user_id", tx.user_id)
  }

  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" })
}
