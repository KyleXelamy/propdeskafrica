import { withAuth, successResponse, errorResponse, HttpError } from "@/lib/api"
import { stkPush, darajaConfigured, normalizePhone } from "@/lib/mpesa/daraja"

/**
 * POST /api/mpesa/stkpush
 * Body: { tenant_id: string, payment_id?: string, amount: number, phone: string }
 *
 * Initiates an M-Pesa STK Push for the given tenant. We pre-create a
 * `mpesa_transactions` row in `initiated` state, then poll for status via
 * /api/mpesa/status/[checkoutRequestId].
 */
export const POST = withAuth(async (req, { supabase, userId }) => {
  const body = await req.json().catch(() => null)
  if (!body) throw new HttpError("Invalid body", 400)

  const tenantId = (body.tenant_id || "").toString()
  const amount = Number(body.amount)
  const phone = (body.phone || "").toString().trim()
  const paymentId = (body.payment_id || "").toString() || null

  if (!tenantId) throw new HttpError("tenant_id required", 400)
  if (!Number.isFinite(amount) || amount < 1) throw new HttpError("amount must be a positive number", 400)
  if (!phone) throw new HttpError("phone required", 400)

  // Confirm the tenant belongs to the caller
  const { data: tenant, error: tErr } = await supabase
    .from("tenants")
    .select("id, full_name, first_name, last_name, monthly_rent, properties(name)")
    .eq("id", tenantId)
    .eq("user_id", userId)
    .maybeSingle()
  if (tErr) return errorResponse(tErr.message, 500)
  if (!tenant) throw new HttpError("Tenant not found", 404)

  if (!darajaConfigured() && process.env.MPESA_SANDBOX_MOCK !== "1") {
    return errorResponse(
      "M-Pesa not configured. Set MPESA_SANDBOX_MOCK=1 in .env.local for mock mode, or set MPESA_CONSUMER_KEY/SECRET/SHORTCODE/PASSKEY/CALLBACK_URL for real.",
      503,
    )
  }

  const normalized = normalizePhone(phone)
  const accountRef = `RENT-${tenant.id.slice(0, 6).toUpperCase()}`
  const result = await stkPush({
    phone: normalized,
    amount: Math.round(amount),
    accountReference: accountRef,
    transactionDesc: "Rent Payment",
  }).catch((e) => ({ error: e.message }))

  if ((result as any).error) {
    return errorResponse((result as any).error, 502)
  }

  const ok = (result as any).ResponseCode === "0"
  const tx = {
    user_id: userId,
    tenant_id: tenantId,
    payment_id: paymentId,
    phone: normalized,
    amount: Math.round(amount),
    merchant_request_id: (result as any).MerchantRequestID || null,
    checkout_request_id: (result as any).CheckoutRequestID || null,
    status: ok ? "initiated" : "failed",
    result_code: ok ? null : (result as any).ResponseCode,
    result_desc: (result as any).ResponseDescription || (result as any).CustomerMessage || null,
    raw_response: result,
  }
  const { data: row, error: insErr } = await supabase
    .from("mpesa_transactions")
    .insert(tx)
    .select()
    .single()
  if (insErr) {
    // Degrade: still surface the Daraja response so the UI can show the prompt.
    return successResponse({ ...tx, db_error: insErr.message, _id: null })
  }
  return successResponse(row)
})
