/**
 * Safaricom Daraja M-Pesa API client.
 *
 * Supports:
 *   - OAuth access token (sandbox + production)
 *   - Lipa Na M-Pesa Online (STK Push)
 *   - STK Push transaction status query
 *   - C2B register / validation / confirmation helpers
 *   - Callback authentication (shared secret + IP allowlist)
 *
 * Reads credentials from environment variables:
 *
 *   MPESA_ENV                "sandbox" | "production"
 *                            ONLY the exact value "sandbox" selects the Daraja
 *                            sandbox. Anything else — including unset, blank or
 *                            a typo — is treated as PRODUCTION (INFRA-007).
 *                            The sandbox is never the default.
 *   MPESA_CONSUMER_KEY       string
 *   MPESA_CONSUMER_SECRET    string
 *   MPESA_SHORTCODE          string  (PayBill or Till number, e.g. 174379)
 *   MPESA_PASSKEY            string  (Lipa Na M-Pesa passkey, given by Safaricom)
 *   MPESA_CALLBACK_URL       string  (publicly reachable HTTPS endpoint)
 *   MPESA_INITIATOR_NAME     string  (optional, for B2C — not used here)
 *   MPESA_CALLBACK_SECRET    string  (shared secret for callback auth)
 *   MPESA_ALLOWED_CALLBACK_IPS  comma-separated CIDRs / IPs of the Safaricom
 *                            callback ranges. MANDATORY for the C2B
 *                            callbacks; optional (defence in depth) for the
 *                            STK callback. Unset/empty never means "allow
 *                            everything" (INFRA-004).
 *   MPESA_ADMIN_EMAILS       comma-separated e-mail addresses of the
 *                            platform operators allowed to re-point the
 *                            platform-wide Daraja URLs (AUTHZ-005).
 *
 * For local development without real credentials, set MPESA_SANDBOX_MOCK=1
 * AND run in a development/test runtime; the helper will then return
 * synthetic (but real-shaped) responses. The mock transport is refused
 * outside `NODE_ENV=development|test` so a production deployment can never
 * self-approve a payment (INFRA-007).
 */

import crypto from "node:crypto"

export type DarajaEnv = "sandbox" | "production"

export interface DarajaConfig {
  env: DarajaEnv
  /** True only when MPESA_ENV is exactly "sandbox". */
  sandbox: boolean
  baseUrl: string
  consumerKey: string
  consumerSecret: string
  shortCode: string
  passkey: string
  callbackUrl: string
  /** The synthetic (mock) transport is ACTIVE. */
  mock: boolean
  /**
   * MPESA_SANDBOX_MOCK=1 was requested but this runtime does not allow the
   * mock transport. Every transport call refuses to run in this state.
   */
  mockBlocked: boolean
}

const SANDBOX = "https://sandbox.safaricom.co.ke"
const PRODUCTION = "https://api.safaricom.co.ke"

let cachedToken: { value: string; expiresAt: number } | null = null

/**
 * The mock transport only exists in an explicitly non-production runtime.
 *
 * `NODE_ENV !== "production"` on its own is not enough: a container image
 * that never sets NODE_ENV (a self-hosted "production" box) satisfies it,
 * and that deployment would then approve payments that never happened.
 * We therefore require an explicit development/test value.
 */
export function isMockEnvironment(nodeEnv: string | undefined = process.env.NODE_ENV): boolean {
  return nodeEnv === "development" || nodeEnv === "test"
}

function loadConfig(): DarajaConfig {
  const requested = (process.env.MPESA_ENV || "").trim().toLowerCase()
  // INFRA-007: an absent or blank MPESA_ENV must NEVER mean "sandbox".
  // Only the exact string "sandbox" selects the Daraja sandbox; everything
  // else (unset, blank, "prod", "Production ", typo) is production.
  const sandbox = requested === "sandbox"
  const env: DarajaEnv = sandbox ? "sandbox" : "production"
  const mockRequested = process.env.MPESA_SANDBOX_MOCK === "1"
  const mock = mockRequested && isMockEnvironment()
  return {
    env,
    sandbox,
    baseUrl: sandbox ? SANDBOX : PRODUCTION,
    consumerKey: process.env.MPESA_CONSUMER_KEY || "",
    consumerSecret: process.env.MPESA_CONSUMER_SECRET || "",
    shortCode: process.env.MPESA_SHORTCODE || "",
    passkey: process.env.MPESA_PASSKEY || "",
    callbackUrl: process.env.MPESA_CALLBACK_URL || "",
    mock,
    mockBlocked: mockRequested && !mock,
  }
}

/** The effective Daraja configuration. Exposed for tests and diagnostics. */
export function darajaConfig(): DarajaConfig {
  return loadConfig()
}

/** True when the synthetic (mock) transport is active right now. */
export function darajaMockMode(): boolean {
  return loadConfig().mock
}

/**
 * Refuse to talk to Daraja when the operator asked for the mock transport in
 * an environment that must not use it. Failing loudly is the point: a
 * production deployment must never silently fall back to a fake payment.
 */
function assertTransportAllowed(cfg: DarajaConfig): void {
  if (cfg.mockBlocked) {
    throw new Error(
      "M-Pesa sandbox mock mode is disabled: MPESA_SANDBOX_MOCK=1 is only honoured when NODE_ENV is 'development' or 'test'. Remove MPESA_SANDBOX_MOCK from this environment.",
    )
  }
}

export function darajaConfigured(): boolean {
  const c = loadConfig()
  // A misconfigured production deployment (mock flag left on) is NOT
  // configured — callers must not be told that payments can be taken.
  if (c.mockBlocked) return false
  return Boolean(c.consumerKey && c.consumerSecret && c.shortCode && c.passkey && c.callbackUrl)
}

/**
 * True when the platform is able to take a payment right now: either the
 * real Daraja credentials are configured, or the mock transport is active
 * (development/test only).
 */
export function darajaPaymentsAvailable(): boolean {
  return darajaConfigured() || darajaMockMode()
}

/**
 * OAuth access token. Cached until ~50 minutes from issue.
 * Returns null in mock mode.
 */
export async function getAccessToken(): Promise<string | null> {
  const cfg = loadConfig()
  assertTransportAllowed(cfg)
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
  /**
   * True when the response was synthesised locally instead of coming from
   * Safaricom. Callers that grant an entitlement MUST check this.
   */
  mocked?: boolean
}

/**
 * Initiate an STK Push. Caller provides the phone in either
 * `2547XXXXXXXX` or `07XXXXXXXX` format — we'll normalize.
 *
 * In mock mode, returns a synthetic successful response (useful for local UI).
 */
export async function stkPush(req: StkPushRequest): Promise<StkPushResponse> {
  const cfg = loadConfig()
  assertTransportAllowed(cfg)
  const phone = normalizePhone(req.phone)

  if (cfg.mock) {
    return {
      MerchantRequestID: "mock-merchant-" + crypto.randomBytes(4).toString("hex"),
      CheckoutRequestID: "ws_CO_" + Date.now() + crypto.randomBytes(3).toString("hex"),
      ResponseCode: "0",
      ResponseDescription: "Success. Request accepted for processing",
      CustomerMessage: "Success. Mocked STK Push.",
      mocked: true,
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
  /**
   * True when the status was synthesised locally instead of read back from
   * Safaricom. A caller that grants a paid entitlement MUST check this.
   */
  mocked?: boolean
}

/**
 * Query the status of an STK push by CheckoutRequestID.
 */
export async function stkQuery(checkoutRequestId: string): Promise<StkQueryResponse> {
  const cfg = loadConfig()
  assertTransportAllowed(cfg)
  if (cfg.mock) {
    return {
      ResponseCode: "0",
      ResponseDescription: "The service request has been accepted successfully",
      MerchantRequestID: "mock-merchant",
      CheckoutRequestID: checkoutRequestId,
      ResultCode: "0",
      ResultDesc: "The service request is processed successfully.",
      mocked: true,
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
 * The Safaricom callback address ranges, as configured by the operator.
 * Empty when MPESA_ALLOWED_CALLBACK_IPS is unset or blank.
 */
export function allowedCallbackIps(): string[] {
  return (process.env.MPESA_ALLOWED_CALLBACK_IPS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Validate that the request is coming from Safaricom (callback only).
 * Uses a configured IP allowlist (comma-separated CIDRs or plain IPs).
 *
 * INFRA-004: this used to return TRUE for every address when the allowlist
 * was unset and MPESA_ENV was not "production" — i.e. it failed OPEN and a
 * deployment that forgot MPESA_ALLOWED_CALLBACK_IPS accepted a forged
 * callback from anywhere. It now fails CLOSED: an unset or empty allowlist
 * rejects every address. Callers that also have a shared secret should use
 * `authenticateMpesaCallback`, which treats the allowlist as defence in
 * depth.
 */
export function isFromSafaricom(remoteAddr: string | null): boolean {
  const list = allowedCallbackIps()
  if (list.length === 0) return false
  if (!remoteAddr) return false
  return ipAllowed(remoteAddr, list)
}

/** True when `ip` matches one of the allowlist entries (exact IP or CIDR). */
function ipAllowed(ip: string, list: string[]): boolean {
  for (const allowed of list) {
    if (allowed.includes("/")) {
      // CIDR
      if (ipInCidr(ip, allowed)) return true
    } else if (allowed === ip) {
      return true
    }
  }
  return false
}

/** Minimal shape of a header bag — a `Headers` object satisfies it. */
export interface HeaderReader {
  get(name: string): string | null
}

/**
 * Headers the HOSTING PLATFORM overwrites on every request. Only these may
 * be used to decide where a request came from.
 *
 * `x-forwarded-for` is deliberately NOT in this list: its first (left-most)
 * value is chosen by the client, so an attacker can send
 * `X-Forwarded-For: <safaricom-ip>` and walk straight through an allowlist
 * check (INFRA-005).
 */
const TRUSTED_IP_HEADERS = ["x-vercel-forwarded-for", "cf-connecting-ip", "x-real-ip"]

/**
 * The client address as observed by the platform, not as claimed by it.
 * Returns the address and the header it came from (null when the platform
 * did not provide one).
 */
export function trustedClientIp(headers: HeaderReader): { ip: string | null; source: string | null } {
  for (const name of TRUSTED_IP_HEADERS) {
    const raw = headers.get(name)
    if (!raw) continue
    const value = raw.split(",")[0]?.trim()
    if (value) return { ip: value, source: name }
  }
  return { ip: null, source: null }
}

/**
 * Constant-time comparison of the shared callback secret.
 *
 * Fails closed: with no MPESA_CALLBACK_SECRET configured nothing verifies,
 * so a deployment that forgets the secret does not silently accept every
 * callback.
 */
export function verifyCallbackSecret(provided: string | null | undefined): boolean {
  const expected = process.env.MPESA_CALLBACK_SECRET || ""
  if (!expected) return false
  if (!provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export type CallbackAuthReason =
  | "ok"
  | "secret_not_configured"
  | "bad_secret"
  | "ip_allowlist_not_configured"
  | "no_trusted_ip"
  | "ip_not_allowed"

export interface CallbackAuthResult {
  ok: boolean
  reason: CallbackAuthReason
  ip: string | null
  ipSource: string | null
}

export interface CallbackAuthOptions {
  /**
   * Require the shared secret to be configured AND correct. Used by the STK
   * callback, where the secret is the primary control.
   */
  requireSecret?: boolean
  /**
   * Require the IP allowlist to be configured AND satisfied. Used by the C2B
   * callbacks: their IP allowlist is the primary control, so an unset
   * allowlist must reject the callback rather than allow everything.
   */
  requireIpAllowlist?: boolean
}

/**
 * Authenticate a Daraja callback.
 *
 * Two independent factors:
 *   1. the shared secret (MPESA_CALLBACK_SECRET), compared in constant time;
 *   2. the Safaricom IP allowlist (MPESA_ALLOWED_CALLBACK_IPS), evaluated
 *      against the platform-set client address only.
 *
 * The secret is enforced whenever it is configured (and is mandatory for the
 * STK callback). The IP allowlist is enforced whenever it is configured, and
 * is mandatory for the C2B callbacks.
 */
export function authenticateMpesaCallback(
  headers: HeaderReader,
  options: CallbackAuthOptions = {},
): CallbackAuthResult {
  const { requireSecret = false, requireIpAllowlist = false } = options
  const secretConfigured = Boolean((process.env.MPESA_CALLBACK_SECRET || "").trim())
  const { ip, source } = trustedClientIp(headers)

  // 1. Shared secret.
  if (requireSecret && !secretConfigured) {
    return { ok: false, reason: "secret_not_configured", ip, ipSource: source }
  }
  if (secretConfigured) {
    if (!verifyCallbackSecret(headers.get("x-mpesa-callback-secret"))) {
      return { ok: false, reason: "bad_secret", ip, ipSource: source }
    }
  }

  // 2. IP allowlist.
  const list = allowedCallbackIps()
  if (list.length === 0) {
    if (requireIpAllowlist) {
      return { ok: false, reason: "ip_allowlist_not_configured", ip, ipSource: source }
    }
    return { ok: true, reason: "ok", ip, ipSource: source }
  }
  if (!ip) {
    return { ok: false, reason: "no_trusted_ip", ip, ipSource: source }
  }
  if (!isFromSafaricom(ip)) {
    return { ok: false, reason: "ip_not_allowed", ip, ipSource: source }
  }
  return { ok: true, reason: "ok", ip, ipSource: source }
}

// ---------------------------------------------------------------------------
// Amount verification (INFRA-006)
// ---------------------------------------------------------------------------

/**
 * Tolerance, in KES, for the settled-amount comparison.
 *
 * THE RULE: a settled amount satisfies an invoice when it is EXACTLY the
 * invoice amount, or within this tolerance of it. M-Pesa settles in whole
 * shillings while `rent_payments.amount` is numeric(12,2), so a single
 * shilling of rounding (50000 vs 50000.50) must not be reported as a
 * mismatch. Anything further apart is a mismatch: the invoice is NOT marked
 * paid and the transaction is queued for review.
 */
export const MPESA_AMOUNT_TOLERANCE_KES = 1

export type AmountComparison = "exact" | "within_tolerance" | "mismatch" | "invalid"

/**
 * Compare a settled amount with the amount owed. Pure function — no I/O.
 */
export function compareSettledAmount(
  expected: number,
  settled: number,
  tolerance: number = MPESA_AMOUNT_TOLERANCE_KES,
): AmountComparison {
  if (!Number.isFinite(expected) || !Number.isFinite(settled)) return "invalid"
  // A non-positive expectation means we have no invoice to compare against,
  // and a non-positive settlement is not a payment.
  if (expected <= 0 || settled <= 0) return "invalid"
  const diff = Math.abs(expected - settled)
  if (diff === 0) return "exact"
  if (diff <= tolerance) return "within_tolerance"
  return "mismatch"
}

/** True when the settled amount satisfies the invoice (see the rule above). */
export function amountSatisfiesInvoice(
  expected: number,
  settled: number,
  tolerance: number = MPESA_AMOUNT_TOLERANCE_KES,
): boolean {
  const verdict = compareSettledAmount(expected, settled, tolerance)
  return verdict === "exact" || verdict === "within_tolerance"
}

export interface AmountCheckInput {
  /** The amount we asked Daraja to charge. */
  expected: number
  /** The amount Daraja reported as settled. */
  settled: number
  /** The rent invoice amount, when the push referenced one. */
  invoiceAmount?: number | null
}

export interface AmountCheckResult {
  ok: boolean
  comparison: AmountComparison
  /** Human readable explanation, present when `ok` is false. */
  reason?: string
}

/**
 * Decide whether a settled payment may mark the rent invoice as paid.
 *
 * The settled amount must satisfy the amount we charged AND — when the push
 * referenced a rent invoice — that invoice's amount. Anything else is a
 * mismatch: the invoice stays unpaid and the transaction is recorded for
 * review.
 */
export function checkSettledAmount(
  input: AmountCheckInput,
  tolerance: number = MPESA_AMOUNT_TOLERANCE_KES,
): AmountCheckResult {
  const { expected, settled, invoiceAmount } = input
  const comparison = compareSettledAmount(expected, settled, tolerance)
  if (comparison === "mismatch" || comparison === "invalid") {
    return {
      ok: false,
      comparison,
      reason: `Amount mismatch: settled ${settled} KES, expected ${expected} KES. Rent payment NOT marked paid — review required.`,
    }
  }
  if (invoiceAmount != null) {
    const invoiceComparison = compareSettledAmount(invoiceAmount, expected, tolerance)
    if (invoiceComparison === "mismatch" || invoiceComparison === "invalid") {
      return {
        ok: false,
        comparison: invoiceComparison,
        reason: `Invoice mismatch: the payment was for ${expected} KES but the invoice is ${invoiceAmount} KES. Rent payment NOT marked paid — review required.`,
      }
    }
  }
  return { ok: true, comparison }
}

/** The message recorded against a transaction whose amount did not match. */
export function amountMismatchMessage(expected: number, settled: number): string {
  return `Amount mismatch: settled ${settled} KES, expected ${expected} KES. Rent payment NOT marked paid — review required.`
}

// ---------------------------------------------------------------------------
// Platform operators (AUTHZ-005)
// ---------------------------------------------------------------------------

/**
 * The platform operators allowed to re-point the platform-wide Daraja URLs.
 *
 * The app has no admin model of its own — `team_members.role` is stored but
 * never enforced anywhere in the authorisation path — so the operator list
 * is explicit: a comma-separated allowlist of e-mail addresses in
 * MPESA_ADMIN_EMAILS. Unset or empty means NOBODY is an operator (fail
 * closed); the owner MUST set this variable.
 */
export function mpesaAdminEmails(): string[] {
  return (process.env.MPESA_ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

/** True when `email` is on the operator allowlist. */
export function isMpesaAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const list = mpesaAdminEmails()
  if (list.length === 0) return false
  return list.includes(email.trim().toLowerCase())
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
  /** True when the response was synthesised locally (development only). */
  mocked?: boolean
}

export async function c2bRegister(req: C2BRegisterRequest): Promise<C2BRegisterResponse> {
  const cfg = loadConfig()
  assertTransportAllowed(cfg)
  if (cfg.mock) {
    return {
      ResponseCode: "0",
      ResponseDescription: "Success (mocked)",
      OriginatorCoversationID: "mock-conv-" + crypto.randomBytes(4).toString("hex"),
      ConversationID: "mock-conv-" + crypto.randomBytes(4).toString("hex"),
      mocked: true,
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
  /** True when the status was synthesised locally (development only). */
  mocked?: boolean
}

export async function c2bTransactionStatus(transId: string): Promise<C2BStatusResponse> {
  const cfg = loadConfig()
  assertTransportAllowed(cfg)
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
      mocked: true,
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
/**
 * Daraja C2B response codes, kept as an inline reference for the register
 * flow. Not part of the public surface — nothing consumes it, and an
 * exported-but-unused constant reads as API that callers depend on.
 */
const C2B_RESPONSE_CODES: Record<string, string> = {
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
