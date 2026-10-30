import { withAuth, successResponse, errorResponse, HttpError } from "@/lib/api"
import {
  stkPush,
  darajaPaymentsAvailable,
  normalizePhone,
  isValidKenyanPhone,
  amountSatisfiesInvoice,
} from "@/lib/mpesa/daraja"

/**
 * POST /api/mpesa/stkpush
 * Body: { tenant_id: string, payment_id?: string, amount: number, phone: string }
 *
 * Initiates an M-Pesa STK Push for the given tenant. We pre-create a
 * `mpesa_transactions` row in `initiated` state, then poll for status via
 * /api/mpesa/status/[checkoutRequestId].
 *
 * SECURITY (INFRA-006): the amount is NOT taken on trust from the client.
 * It is compared with the amount owed — the referenced `rent_payments` row,
 * otherwise the tenant's monthly rent — and a push that does not match is
 * rejected before a Daraja call is made.
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
  // Reject bad MSISDNs before spending a Daraja call on them. Without this,
  // a typo'd or landline number produced an opaque upstream error and a
  // half-created transaction row instead of a clear 400.
  if (!isValidKenyanPhone(phone)) {
    throw new HttpError(
      "phone must be a Kenyan mobile number in 07XX/01XX or 254 7XX/254 1XX form",
      400,
    )
  }

  // Confirm the tenant belongs to the caller
  const { data: tenant, error: tErr } = await supabase
    .from("tenants")
    .select("id, full_name, first_name, last_name, monthly_rent, properties(name)")
    .eq("id", tenantId)
    .eq("user_id", userId)
    .maybeSingle()
  if (tErr) return errorResponse(tErr.message, 500)
  if (!tenant) throw new HttpError("Tenant not found", 404)

  // INFRA-006: derive the amount owed server-side. A `payment_id` must
  // belong to the caller AND to this tenant; otherwise the expected amount
  // is the tenant's monthly rent.
  let expectedAmount: number
  let expectedSource: string
  if (paymentId) {
    const { data: payment, error: pErr } = await supabase
      .from("rent_payments")
      .select("id, amount, tenant_id")
      .eq("id", paymentId)
      .eq("user_id", userId)
      .maybeSingle()
    if (pErr) return errorResponse(pErr.message, 500)
    if (!payment) throw new HttpError("Payment not found", 404)
    if (payment.tenant_id && payment.tenant_id !== tenantId) {
      throw new HttpError("Payment does not belong to this tenant", 400)
    }
    expectedAmount = Number(payment.amount)
    expectedSource = "rent payment"
  } else {
    expectedAmount = Number(tenant.monthly_rent)
    expectedSource = "monthly rent"
  }

  if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
    throw new HttpError(
      `No ${expectedSource} to charge — set a monthly rent for this tenant, or send a payment_id`,
      400,
    )
  }

  // Tolerance: an exact match, or within MPESA_AMOUNT_TOLERANCE_KES (1 KES)
  // of it — see lib/mpesa/daraja.ts for the rule.
  if (!amountSatisfiesInvoice(expectedAmount, amount)) {
    throw new HttpError(
      `Amount mismatch: KES ${Math.round(amount)} does not match the amount due (KES ${expectedAmount})`,
      400,
    )
  }

  // INFRA-007: the mock transport is only available in development/test.
  // `darajaPaymentsAvailable()` is false when MPESA_SANDBOX_MOCK=1 is set in
  // a production runtime, so a misconfigured deployment refuses payments
  // instead of pretending they worked.
  if (!darajaPaymentsAvailable()) {
    return errorResponse(
      "Payments are temporarily unavailable. Please try again later.",
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
    console.error("[api] mpesa/stkpush daraja call failed", (result as any).error)
    return errorResponse("Could not reach the M-Pesa gateway", 502)
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
