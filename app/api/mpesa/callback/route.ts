import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { authenticateMpesaCallback, checkSettledAmount } from "@/lib/mpesa/daraja"

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
 *
 * SECURITY (INFRA-005 / INFRA-006)
 *   - The shared secret (MPESA_CALLBACK_SECRET) is the primary control and
 *     is compared in constant time. A deployment without it rejects every
 *     callback (503) instead of trusting the request.
 *   - The IP allowlist (MPESA_ALLOWED_CALLBACK_IPS) is defence in depth
 *     only. It is evaluated against the platform-set client address
 *     (x-vercel-forwarded-for / cf-connecting-ip / x-real-ip) — never
 *     against the client-controllable x-forwarded-for header.
 *   - The settled amount is compared with the amount we charged and with the
 *     rent invoice before the invoice is marked paid. A mismatch leaves the
 *     invoice unpaid and is recorded for review.
 */
export async function POST(req: NextRequest) {
  // Public endpoint — we DO NOT use withAuth here. Authentication is the
  // shared secret below, with the IP allowlist as a second factor.
  const auth = authenticateMpesaCallback(req.headers, {
    requireSecret: true,
    requireIpAllowlist: false,
  })
  if (!auth.ok) {
    if (auth.reason === "secret_not_configured") {
      return NextResponse.json({ ResultCode: 1, ResultDesc: "Callback secret is not configured" }, { status: 503 })
    }
    console.warn("[mpesa/callback] rejected", {
      reason: auth.reason,
      ip: auth.ip,
      ipSource: auth.ipSource,
    })
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

  if (!tx) {
    // A callback for a checkout id we never issued. Nothing to settle.
    console.warn("[mpesa/callback] callback for an unknown checkout id", { checkoutId, merchantId })
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" })
  }

  // If the push succeeded AND the original rent_payments row is marked
  // pending, mark it paid. This is the "magic" — tenant pays via M-Pesa,
  // their rent balance updates automatically.
  if (status === "completed") {
    // INFRA-006: the settled amount must match what we charged (and the
    // rent invoice) before the invoice is marked paid. A KES 1 payment must
    // not settle a KES 50,000 invoice.
    const settledAmount = Number(meta.Amount)
    const expectedAmount = Number(tx.amount)

    let invoiceAmount: number | null = null
    if (tx.payment_id) {
      const { data: invoice } = await supabase
        .from("rent_payments")
        .select("id, amount")
        .eq("id", tx.payment_id)
        .eq("user_id", tx.user_id)
        .maybeSingle()
      if (invoice) invoiceAmount = Number(invoice.amount)
    }

    const verdict = checkSettledAmount({ expected: expectedAmount, settled: settledAmount, invoiceAmount })

    if (!verdict.ok) {
      // Record the mismatch on the transaction so it can be reviewed. The
      // rent invoice is deliberately NOT touched: it stays unpaid.
      await supabase
        .from("mpesa_transactions")
        .update({ result_desc: verdict.reason })
        .eq("id", tx.id)
      console.error("[mpesa/callback] settled amount does not match the invoice", {
        transactionId: tx.id,
        paymentId: tx.payment_id,
        expected: expectedAmount,
        invoiceAmount,
        settled: settledAmount,
        comparison: verdict.comparison,
      })
      // Ack to Daraja: the transaction IS recorded, retrying would only
      // create duplicates.
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" })
    }

    if (tx.payment_id) {
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
  }

  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" })
}
