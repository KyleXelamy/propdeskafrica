/**
 * Safaricom Daraja M-Pesa API client.
 *
 * Supports:
 *   - OAuth access token (sandbox + production)
 *   - Lipa Na M-Pesa Online (STK Push)
 *   - STK Push transaction status query
 *   - Callback signature validation (IP allowlist — production only)
 *
 * Reads credentials from environment variables:
 *
 *   MPESA_ENV                "sandbox" | "production"  (default: sandbox)
 *   MPESA_CONSUMER_KEY       string
 *   MPESA_CONSUMER_SECRET    string
 *   MPESA_SHORTCODE          string  (PayBill or Till number, e.g. 174379)
 *   MPESA_PASSKEY            string  (Lipa Na M-Pesa passkey, given by Safaricom)
 *   MPESA_CALLBACK_URL       string  (publicly reachable HTTPS endpoint)
 *   MPESA_INITIATOR_NAME     string  (optional, for B2C — not used here)
 *   MPESA_ALLOWED_CALLBACK_IPS  comma-separated CIDRs (optional)
 *
 * For local development without real credentials, set MPESA_SANDBOX_MOCK=1
 * and the helper will return synthetic (but real-shaped) responses. Useful
 * for UI work without touching Daraja.
 */

import crypto from "node:crypto"

export type DarajaEnv = "sandbox" | "production"

export interface DarajaConfig {
  env: DarajaEnv
  baseUrl: string
  consumerKey: string
  consumerSecret: string
  shortCode: string
  passkey: string
  callbackUrl: string
  mock: boolean
}

const SANDBOX = "https://sandbox.safaricom.co.ke"
const PRODUCTION = "https://api.safaricom.co.ke"

let cachedToken: { value: string; expiresAt: number } | null = null

function loadConfig(): DarajaConfig {
  const env = (process.env.MPESA_ENV === "production" ? "production" : "sandbox") as DarajaEnv
  return {
    env,
    baseUrl: env === "production" ? PRODUCTION : SANDBOX,
    consumerKey: process.env.MPESA_CONSUMER_KEY || "",
    consumerSecret: process.env.MPESA_CONSUMER_SECRET || "",
    shortCode: process.env.MPESA_SHORTCODE || "",
    passkey: process.env.MPESA_PASSKEY || "",
    callbackUrl: process.env.MPESA_CALLBACK_URL || "",
    mock: process.env.MPESA_SANDBOX_MOCK === "1",
  }
}

export function darajaConfigured(): boolean {
  const c = loadConfig()
  return Boolean(c.consumerKey && c.consumerSecret && c.shortCode && c.passkey && c.callbackUrl)
}

/**
 * OAuth access token. Cached until ~50 minutes from issue.
 * Returns null in mock mode.
 */
export async function getAccessToken(): Promise<string | null> {
  const cfg = loadConfig()
  if (cfg.mock) return null

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value
  }

  const auth = Buffer.from(`${cfg.consumerKey}:${cfg.consumerSecret}`).toString("base64")
  const res = await fetch(`${cfg.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: "no-store",
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Daraja OAuth failed: ${res.status} ${text}`)
  }
  const json = (await res.json()) as { access_token: string; expires_in: string }
  cachedToken = {
    value: json.access_token,
    // Daraja's expires_in is in seconds (typically 3599).
    expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000,
  }
  return cachedToken.value
}

/**
 * Timestamp in Daraja's required format: YYYYMMDDHHmmss in EAT (UTC+3).
 */
export function darajaTimestamp(d: Date = new Date()): string {
  const eat = new Date(d.getTime() + 3 * 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, "0")
  return (
    eat.getUTCFullYear().toString() +
    pad(eat.getUTCMonth() + 1) +
    pad(eat.getUTCDate()) +
    pad(eat.getUTCHours()) +
    pad(eat.getUTCMinutes()) +
    pad(eat.getUTCSeconds())
  )
}

/**
 * Generate the STK Push password: base64(shortcode + passkey + timestamp).
 */
export function stkPassword(shortcode: string, passkey: string, timestamp: string): string {
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64")
}

export interface StkPushRequest {
  phone: string          // E.164 or 2547XXXXXXXX
  amount: number         // integer KES
  accountReference: string
  transactionDesc?: string
}

export interface StkPushResponse {
  MerchantRequestID: string
  CheckoutRequestID: string
  ResponseCode: string
  ResponseDescription: string
  CustomerMessage?: string
}

/**
 * Initiate an STK Push. Caller provides the phone in either
 * `2547XXXXXXXX` or `07XXXXXXXX` format — we'll normalize.
 *
 * In mock mode, returns a synthetic successful response (useful for local UI).
 */
export async function stkPush(req: StkPushRequest): Promise<StkPushResponse> {
  const cfg = loadConfig()
  const phone = normalizePhone(req.phone)

  if (cfg.mock) {
    return {
      MerchantRequestID: "mock-merchant-" + crypto.randomBytes(4).toString("hex"),
      CheckoutRequestID: "ws_CO_" + Date.now() + crypto.randomBytes(3).toString("hex"),
      ResponseCode: "0",
      ResponseDescription: "Success. Request accepted for processing",
      CustomerMessage: "Success. Mocked STK Push.",
    }
  }

  const token = await getAccessToken()
  if (!token) throw new Error("No Daraja access token")

  const timestamp = darajaTimestamp()
  const password = stkPassword(cfg.shortCode, cfg.passkey, timestamp)
  const body = {
    BusinessShortCode: cfg.shortCode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: Math.round(req.amount),
    PartyA: phone,
    PartyB: cfg.shortCode,
    PhoneNumber: phone,
    CallBackURL: cfg.callbackUrl,
    AccountReference: req.accountReference.slice(0, 12),
    TransactionDesc: (req.transactionDesc || "Rent Payment").slice(0, 13),
  }

  const res = await fetch(`${cfg.baseUrl}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  })
  const text = await res.text()
  let json: any
  try { json = JSON.parse(text) } catch { json = { ResponseDescription: text } }
  if (!res.ok) {
    throw new Error(`STK push failed: ${res.status} ${JSON.stringify(json)}`)
  }
  return json as StkPushResponse
}

export interface StkQueryResponse {
  ResponseCode: string
  ResponseDescription: string
  MerchantRequestID?: string
  CheckoutRequestID?: string
  ResultCode?: string
  ResultDesc?: string
}

/**
 * Query the status of an STK push by CheckoutRequestID.
 */
export async function stkQuery(checkoutRequestId: string): Promise<StkQueryResponse> {
  const cfg = loadConfig()
  if (cfg.mock) {
    return {
      ResponseCode: "0",
      ResponseDescription: "The service request has been accepted successfully",
      MerchantRequestID: "mock-merchant",
      CheckoutRequestID: checkoutRequestId,
      ResultCode: "0",
      ResultDesc: "The service request is processed successfully.",
    }
  }
  const token = await getAccessToken()
  if (!token) throw new Error("No Daraja access token")
  const timestamp = darajaTimestamp()
  const password = stkPassword(cfg.shortCode, cfg.passkey, timestamp)
  const res = await fetch(`${cfg.baseUrl}/mpesa/transactionstatus/v1/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      Initiator: process.env.MPESA_INITIATOR_NAME || "",
      SecurityCredential: process.env.MPESA_SECURITY_CREDENTIAL || "",
      CommandID: "TransactionStatusQuery",
      TransactionID: checkoutRequestId,
      PartyA: cfg.shortCode,
      IdentifierType: "4",
      ResultURL: cfg.callbackUrl,
      QueueTimeOutURL: cfg.callbackUrl,
      Remarks: "Status query",
      Occasion: "RentStatus",
    }),
    cache: "no-store",
  })
  const json = (await res.json()) as StkQueryResponse
  if (!res.ok) {
    throw new Error(`STK query failed: ${res.status} ${JSON.stringify(json)}`)
  }
  return json
}

/**
 * Normalize a Kenyan phone to 2547XXXXXXXX format.
 * Accepts: 07XXXXXXXX, +2547XXXXXXXX, 2547XXXXXXXX, 7XXXXXXXX.
 */
export function normalizePhone(input: string): string {
  const trimmed = (input || "").replace(/\s+/g, "").replace(/^\+/, "")
  if (/^254\d{9}$/.test(trimmed)) return trimmed
  if (/^0\d{9}$/.test(trimmed)) return "254" + trimmed.slice(1)
  if (/^\d{9}$/.test(trimmed)) return "254" + trimmed
  return trimmed
}

/**
 * Validate a Kenyan phone number. Returns true if it normalizes to 2547XXXXXXXX.
 */
export function isValidKenyanPhone(input: string): boolean {
  return /^254(7|1)\d{8}$/.test(normalizePhone(input))
}

/**
 * Validate that the request is coming from Safaricom (callback only).
 * Uses a configured IP allowlist (comma-separated CIDRs or plain IPs).
 */
export function isFromSafaricom(remoteAddr: string | null): boolean {
  const list = (process.env.MPESA_ALLOWED_CALLBACK_IPS || "").split(",").map((s) => s.trim()).filter(Boolean)
  if (list.length === 0) {
    return process.env.MPESA_ENV !== "production"
  }
  if (!remoteAddr) return false
  for (const allowed of list) {
    if (allowed.includes("/")) {
      // CIDR
      if (ipInCidr(remoteAddr, allowed)) return true
    } else if (allowed === remoteAddr) {
      return true
    }
  }
  return false
}

function ipInCidr(ip: string, cidr: string): boolean {
  const [base, bitsStr] = cidr.split("/")
  const bits = Number(bitsStr)
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false
  const ipInt = ipToInt(ip)
  const baseInt = ipToInt(base)
  if (ipInt === null || baseInt === null) return false
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
  return (ipInt & mask) === (baseInt & mask)
}

function ipToInt(ip: string): number | null {
  const parts = ip.split(".")
  if (parts.length !== 4) return null
  let n = 0
  for (const p of parts) {
    const x = Number(p)
    if (isNaN(x) || x < 0 || x > 255) return null
    n = (n * 256) + x
  }
  return n
}

// ====================================================================
// C2B (Customer-to-Business) — paybill / till incoming payments
// ====================================================================
//
// C2B is the reverse of STK Push: instead of the business pushing a
// prompt to the customer, the customer initiates the payment to a
// paybill / till number. Daraja then calls TWO endpoints on our side:
//
//   1. Validation URL   — called BEFORE completing the transaction.
//                          We respond {ResultCode: 0} to accept or
//                          {ResultCode: C2B00012} to reject.
//   2. Confirmation URL — called AFTER the transaction completes.
//                          Body contains the full receipt data
//                          (TransID, TransAmount, MSISDN, BillRefNumber…)
//                          which we persist and feed to the
//                          reconciliation engine.
//
// Both endpoints must be registered with Daraja once per shortcode via
// the C2B Register URL API. The response code we return from
// validation is what determines whether the customer's M-Pesa
// prompt actually charges them.

export type C2BResponseCode = "0" | "C2B00011" | "C2B00012" | "C2B00013" | "C2B00014" | "C2B00015" | "C2B00016" | "C2B00017" | "C2B00018" | "C2B00019" | "C2B00020"

/**
 * Register the validation + confirmation URLs with Daraja for a shortcode.
 * Run this ONCE per paybill / till when setting it up. After the first
 * successful call, the URLs are remembered — you don't need to call this
 * on every transaction.
 *
 * Sandbox endpoint:  POST /mpesa/c2b/v1/registerurl
 * Production:        POST /mpesa/c2b/v1/registerurl
 */
export interface C2BRegisterRequest {
  shortCode: string
  responseType: "Completed" | "Cancelled"
  validationUrl: string  // must be HTTPS, publicly reachable
  confirmationUrl: string // must be HTTPS, publicly reachable
}

export interface C2BRegisterResponse {
  ResponseCode?: string
  ResponseDescription?: string
  OriginatorCoversationID?: string
  ConversationID?: string
}

export async function c2bRegister(req: C2BRegisterRequest): Promise<C2BRegisterResponse> {
  const cfg = loadConfig()
  if (cfg.mock) {
    return {
      ResponseCode: "0",
      ResponseDescription: "Success (mocked)",
      OriginatorCoversationID: "mock-conv-" + crypto.randomBytes(4).toString("hex"),
      ConversationID: "mock-conv-" + crypto.randomBytes(4).toString("hex"),
    }
  }
  const token = await getAccessToken()
  if (!token) throw new Error("No Daraja access token")

  const res = await fetch(`${cfg.baseUrl}/mpesa/c2b/v1/registerurl`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ShortCode: req.shortCode,
      ResponseType: req.responseType,
      ConfirmationURL: req.confirmationUrl,
      ValidationURL: req.validationUrl,
    }),
    cache: "no-store",
  })
  const text = await res.text()
  let json: any
  try { json = JSON.parse(text) } catch { json = { ResponseDescription: text } }
  if (!res.ok) {
    throw new Error(`C2B register failed: ${res.status} ${JSON.stringify(json)}`)
  }
  return json as C2BRegisterResponse
}

/**
 * Body Daraja POSTs to our validation URL when a customer initiates a
 * paybill / till payment. We respond with {ResultCode, ResultDesc} —
 * code 0 to accept, any other code to reject.
 */
export interface C2BValidationRequest {
  TransactionType: string
  TransID: string
  TransTime: string
  TransAmount: string | number
  BusinessShortCode: string
  BillRefNumber: string
  InvoiceNumber?: string
  OrgAccountBalance?: string
  ThirdPartyTransID?: string
  MSISDN: string
  FirstName?: string
  MiddleName?: string
  LastName?: string
}

export interface C2BValidationResponse {
  ResultCode: C2BResponseCode | string
  ResultDesc: string
}

export interface C2BValidationContext {
  /** Best-effort tenant account reference decoded from BillRefNumber. */
  billRef: string
  /** The Daraja transaction id. */
  transId: string
}

/**
 * Build the validation response. Pure function — no I/O.
 *
 * To reject, return a non-zero ResultCode with a human-readable
 * ResultDesc. To accept, return "0".
 */
export function buildC2BValidationResponse(
  accept: boolean,
  reason = "Accepted",
): C2BValidationResponse {
  return accept
    ? { ResultCode: "0", ResultDesc: reason }
    : { ResultCode: "C2B00012", ResultDesc: reason }
}

/**
 * Pull the tenant account reference out of a BillRefNumber. The convention
 * we use is `<tenantId>` or `<tenantId>-<unitId>` — falls back to the raw
 * string if neither shape matches.
 */
export function parseBillRef(billRef: string): { tenantId: string | null; unitId: string | null } {
  if (!billRef) return { tenantId: null, unitId: null }
  const trimmed = billRef.trim()
  // Try UUID[-UUID] format first
  const m = trimmed.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:-(.+))?$/i)
  if (m) return { tenantId: m[1], unitId: m[2] || null }
  // Fall back to a 6-12 char tenant code
  if (/^[A-Z0-9]{4,12}$/i.test(trimmed)) return { tenantId: trimmed.toUpperCase(), unitId: null }
  return { tenantId: null, unitId: null }
}

/**
 * Body Daraja POSTs to our confirmation URL AFTER the transaction has
 * completed (success or failure). We persist this to `c2b_transactions`
 * and run the reconciliation engine to match it to a tenant / payment.
 */
export interface C2BConfirmationRequest extends C2BValidationRequest {}

/**
 * Query the status of a single C2B transaction by its TransID.
 * Useful for nightly reconciliation against Daraja's ledger.
 */
export interface C2BStatusResponse {
  ResponseCode?: string
  ResponseDescription?: string
  TransactionReceipt?: string
  TransactionStatus?: string
  Amount?: number | string
  TransactionDate?: string
  MSISDN?: string
  FirstName?: string
  MiddleName?: string
  LastName?: string
}

export async function c2bTransactionStatus(transId: string): Promise<C2BStatusResponse> {
  const cfg = loadConfig()
  if (cfg.mock) {
    return {
      ResponseCode: "0",
      ResponseDescription: "Success (mocked)",
      TransactionReceipt: transId,
      TransactionStatus: "Completed",
      Amount: 25000,
      TransactionDate: darajaTimestamp(),
      MSISDN: "254712345678",
      FirstName: "Jane",
      LastName: "Doe",
    }
  }
  const token = await getAccessToken()
  if (!token) throw new Error("No Daraja access token")
  const res = await fetch(`${cfg.baseUrl}/mpesa/transactionstatus/v1/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      Initiator: process.env.MPESA_INITIATOR_NAME || "",
      SecurityCredential: process.env.MPESA_SECURITY_CREDENTIAL || "",
      CommandID: "TransactionStatusQuery",
      TransactionID: transId,
      PartyA: cfg.shortCode,
      IdentifierType: "4",
      ResultURL: cfg.callbackUrl,
      QueueTimeOutURL: cfg.callbackUrl,
      Remarks: "C2B status query",
      Occasion: "C2BStatus",
    }),
    cache: "no-store",
  })
  const json = (await res.json()) as C2BStatusResponse
  if (!res.ok) {
    throw new Error(`C2B status query failed: ${res.status} ${JSON.stringify(json)}`)
  }
  return json
}

/**
 * The full set of allowed validation response codes. Reference only —
 * the API only needs 0 (accept) or C2B00012 (reject). Other codes
 * exist for finer-grained control on Daraja's side.
 */
export const C2B_RESPONSE_CODES: Record<string, string> = {
  "0": "Success",
  "C2B00011": "Invalid MSISDN",
  "C2B00012": "Invalid AccountNumber",
  "C2B00013": "Invalid Amount",
  "C2B00014": "Invalid KYC Details",
  "C2B00015": "Invalid Transaction Type",
  "C2B00016": "Invalid Reference",
  "C2B00017": "Invalid Short Code",
  "C2B00018": "Invalid Phone Number",
  "C2B00019": "Invalid Business Number",
  "C2B00020": "Invalid Account Balance",
}
