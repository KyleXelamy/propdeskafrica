import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  MPESA_AMOUNT_TOLERANCE_KES,
  amountMismatchMessage,
  amountSatisfiesInvoice,
  authenticateMpesaCallback,
  checkSettledAmount,
  compareSettledAmount,
  darajaConfig,
  darajaConfigured,
  darajaMockMode,
  darajaPaymentsAvailable,
  isFromSafaricom,
  isMpesaAdminEmail,
  isMockEnvironment,
  mpesaAdminEmails,
  stkPush,
  stkQuery,
  trustedClientIp,
  verifyCallbackSecret,
} from "./daraja"

/**
 * Regression tests for the M-Pesa payment-integrity hardening.
 *
 *   INFRA-004 — the C2B IP allowlist failed OPEN when
 *                MPESA_ALLOWED_CALLBACK_IPS was unset.
 *   INFRA-005 — the STK callback trusted the first x-forwarded-for hop,
 *                which the client chooses.
 *   INFRA-006 — the callback marked an invoice paid without comparing the
 *                settled amount with the amount owed.
 *   INFRA-007 — a paid subscription was granted for free when MPESA_ENV was
 *                not "production" or MPESA_SANDBOX_MOCK=1.
 *   AUTHZ-005 — any signed-in user could re-point the platform's Daraja
 *                URLs.
 *
 * These tests are hermetic: no network, no database, no Supabase. The
 * environment is snapshotted and restored around every case.
 */

const SAVED_ENV = { ...process.env }

function setEnv(values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

function headers(values: Record<string, string | undefined>) {
  const map = new Map<string, string>()
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) map.set(key.toLowerCase(), value)
  }
  return {
    get(name: string) {
      return map.get(name.toLowerCase()) ?? null
    },
  }
}

beforeEach(() => {
  // Start from a known state: no M-Pesa configuration at all.
  setEnv({
    MPESA_ENV: undefined,
    MPESA_SANDBOX_MOCK: undefined,
    MPESA_CALLBACK_SECRET: undefined,
    MPESA_ALLOWED_CALLBACK_IPS: undefined,
    MPESA_ADMIN_EMAILS: undefined,
    MPESA_CONSUMER_KEY: undefined,
    MPESA_CONSUMER_SECRET: undefined,
    MPESA_SHORTCODE: undefined,
    MPESA_PASSKEY: undefined,
    MPESA_CALLBACK_URL: undefined,
    NODE_ENV: "test",
  })
})

afterEach(() => {
  process.env = { ...SAVED_ENV }
})

// ---------------------------------------------------------------------------
// INFRA-004 — the IP allowlist must fail CLOSED
// ---------------------------------------------------------------------------

describe("INFRA-004: the C2B IP allowlist fails closed", () => {
  // protects INFRA-004
  it("rejects every address when the allowlist is unset", () => {
    expect(isFromSafaricom("196.201.214.10")).toBe(false)
    expect(isFromSafaricom("127.0.0.1")).toBe(false)
  })

  // protects INFRA-004
  it("rejects every address when the allowlist is blank", () => {
    setEnv({ MPESA_ALLOWED_CALLBACK_IPS: "   ,  , " })
    expect(isFromSafaricom("196.201.214.10")).toBe(false)
  })

  // protects INFRA-004
  it("no longer fails open just because MPESA_ENV is not production", () => {
    setEnv({ MPESA_ENV: "sandbox", MPESA_ALLOWED_CALLBACK_IPS: undefined })
    expect(isFromSafaricom("203.0.113.9")).toBe(false)
    setEnv({ MPESA_ENV: undefined })
    expect(isFromSafaricom("203.0.113.9")).toBe(false)
  })

  // protects INFRA-004
  it("still accepts an address that is on the allowlist (exact IP and CIDR)", () => {
    setEnv({ MPESA_ALLOWED_CALLBACK_IPS: "196.201.214.10, 203.0.113.0/24" })
    expect(isFromSafaricom("196.201.214.10")).toBe(true)
    expect(isFromSafaricom("203.0.113.55")).toBe(true)
    expect(isFromSafaricom("203.0.114.55")).toBe(false)
    expect(isFromSafaricom(null)).toBe(false)
  })

  // protects INFRA-004
  it("rejects a C2B callback when the allowlist is not configured", () => {
    const result = authenticateMpesaCallback(headers({}), { requireIpAllowlist: true })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe("ip_allowlist_not_configured")
  })

  // protects INFRA-004
  it("rejects a C2B callback from an address that is not allowlisted", () => {
    setEnv({ MPESA_ALLOWED_CALLBACK_IPS: "196.201.214.10" })
    const result = authenticateMpesaCallback(
      headers({ "x-vercel-forwarded-for": "198.51.100.7" }),
      { requireIpAllowlist: true },
    )
    expect(result.ok).toBe(false)
    expect(result.reason).toBe("ip_not_allowed")
  })

  // protects INFRA-004
  it("accepts a C2B callback from an allowlisted address", () => {
    setEnv({ MPESA_ALLOWED_CALLBACK_IPS: "196.201.214.10" })
    const result = authenticateMpesaCallback(
      headers({ "x-vercel-forwarded-for": "196.201.214.10" }),
      { requireIpAllowlist: true },
    )
    expect(result.ok).toBe(true)
    expect(result.ip).toBe("196.201.214.10")
  })

  // protects INFRA-004
  it("requires the shared secret when one is configured", () => {
    setEnv({
      MPESA_ALLOWED_CALLBACK_IPS: "196.201.214.10",
      MPESA_CALLBACK_SECRET: "s3cr3t-callback-secret",
    })

    const missing = authenticateMpesaCallback(
      headers({ "x-vercel-forwarded-for": "196.201.214.10" }),
      { requireIpAllowlist: true },
    )
    expect(missing.ok).toBe(false)
    expect(missing.reason).toBe("bad_secret")

    const wrong = authenticateMpesaCallback(
      headers({
        "x-vercel-forwarded-for": "196.201.214.10",
        "x-mpesa-callback-secret": "nope",
      }),
      { requireIpAllowlist: true },
    )
    expect(wrong.ok).toBe(false)
    expect(wrong.reason).toBe("bad_secret")

    const right = authenticateMpesaCallback(
      headers({
        "x-vercel-forwarded-for": "196.201.214.10",
        "x-mpesa-callback-secret": "s3cr3t-callback-secret",
      }),
      { requireIpAllowlist: true },
    )
    expect(right.ok).toBe(true)
  })

  // protects INFRA-004
  it("reports a missing secret instead of verifying everything", () => {
    expect(verifyCallbackSecret("anything")).toBe(false)
    expect(verifyCallbackSecret(null)).toBe(false)

    setEnv({ MPESA_CALLBACK_SECRET: "s3cr3t-callback-secret" })
    expect(verifyCallbackSecret("s3cr3t-callback-secret")).toBe(true)
    expect(verifyCallbackSecret("s3cr3t-callback-secre")).toBe(false)
    expect(verifyCallbackSecret("s3cr3t-callback-secretX")).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// INFRA-005 — the client-controllable x-forwarded-for header
// ---------------------------------------------------------------------------

describe("INFRA-005: the callback never trusts x-forwarded-for", () => {
  // protects INFRA-005
  it("does not read the client IP from x-forwarded-for", () => {
    const ip = trustedClientIp(headers({ "x-forwarded-for": "196.201.214.10" }))
    expect(ip.ip).toBeNull()
    expect(ip.source).toBeNull()
  })

  // protects INFRA-005
  it("cannot be fooled by spoofing x-forwarded-for with a Safaricom address", () => {
    setEnv({ MPESA_ALLOWED_CALLBACK_IPS: "196.201.214.10" })
    const result = authenticateMpesaCallback(
      headers({ "x-forwarded-for": "196.201.214.10" }),
      { requireIpAllowlist: true },
    )
    expect(result.ok).toBe(false)
    expect(result.reason).toBe("no_trusted_ip")
  })

  // protects INFRA-005
  it("cannot be fooled by spoofing x-forwarded-for while a real address is known", () => {
    setEnv({ MPESA_ALLOWED_CALLBACK_IPS: "196.201.214.10" })
    const result = authenticateMpesaCallback(
      headers({
        "x-forwarded-for": "196.201.214.10",
        "x-real-ip": "198.51.100.7",
      }),
      { requireIpAllowlist: true },
    )
    expect(result.ok).toBe(false)
    expect(result.reason).toBe("ip_not_allowed")
    expect(result.ip).toBe("198.51.100.7")
  })

  // protects INFRA-005
  it("prefers the platform header over the forwarded header", () => {
    const ip = trustedClientIp(
      headers({
        "x-forwarded-for": "203.0.113.1",
        "x-vercel-forwarded-for": "196.201.214.10",
      }),
    )
    expect(ip.ip).toBe("196.201.214.10")
    expect(ip.source).toBe("x-vercel-forwarded-for")
  })

  // protects INFRA-005
  it("falls back to x-real-ip when the platform header is absent", () => {
    const ip = trustedClientIp(headers({ "x-real-ip": "196.201.214.10" }))
    expect(ip.ip).toBe("196.201.214.10")
    expect(ip.source).toBe("x-real-ip")
  })

  // protects INFRA-005
  it("keeps the shared secret as the mandatory primary control of the STK callback", () => {
    // No secret configured at all: the callback can never be authenticated.
    const unconfigured = authenticateMpesaCallback(headers({}), { requireSecret: true })
    expect(unconfigured.ok).toBe(false)
    expect(unconfigured.reason).toBe("secret_not_configured")

    setEnv({ MPESA_CALLBACK_SECRET: "s3cr3t-callback-secret" })

    const wrong = authenticateMpesaCallback(
      headers({ "x-mpesa-callback-secret": "wrong" }),
      { requireSecret: true },
    )
    expect(wrong.ok).toBe(false)
    expect(wrong.reason).toBe("bad_secret")

    const right = authenticateMpesaCallback(
      headers({ "x-mpesa-callback-secret": "s3cr3t-callback-secret" }),
      { requireSecret: true },
    )
    expect(right.ok).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// INFRA-006 — the settled amount must match the amount owed
// ---------------------------------------------------------------------------

describe("INFRA-006: the settled amount is compared with the invoice", () => {
  // protects INFRA-006
  it("does not accept KES 1 for a KES 50,000 invoice", () => {
    expect(compareSettledAmount(50000, 1)).toBe("mismatch")
    expect(amountSatisfiesInvoice(50000, 1)).toBe(false)
    expect(checkSettledAmount({ expected: 50000, settled: 1 }).ok).toBe(false)
  })

  // protects INFRA-006
  it("accepts an exact settlement", () => {
    expect(compareSettledAmount(50000, 50000)).toBe("exact")
    expect(amountSatisfiesInvoice(50000, 50000)).toBe(true)
    expect(checkSettledAmount({ expected: 50000, settled: 50000 }).ok).toBe(true)
  })

  // protects INFRA-006
  it("accepts a settlement inside the documented one-shilling tolerance", () => {
    expect(MPESA_AMOUNT_TOLERANCE_KES).toBe(1)
    expect(compareSettledAmount(50000, 49999)).toBe("within_tolerance")
    expect(amountSatisfiesInvoice(50000, 49999)).toBe(true)
    expect(compareSettledAmount(50000, 50001)).toBe("within_tolerance")
    expect(compareSettledAmount(50000.5, 50000)).toBe("within_tolerance")
  })

  // protects INFRA-006
  it("rejects a settlement outside the tolerance", () => {
    expect(compareSettledAmount(50000, 49998)).toBe("mismatch")
    expect(amountSatisfiesInvoice(50000, 49998)).toBe(false)
  })

  // protects INFRA-006
  it("treats a missing or nonsensical amount as invalid, never as a match", () => {
    expect(compareSettledAmount(50000, Number.NaN)).toBe("invalid")
    expect(compareSettledAmount(Number.NaN, 50000)).toBe("invalid")
    expect(compareSettledAmount(0, 50000)).toBe("invalid")
    expect(compareSettledAmount(50000, 0)).toBe("invalid")
    expect(compareSettledAmount(50000, -1)).toBe("invalid")
    expect(checkSettledAmount({ expected: 50000, settled: Number.NaN }).ok).toBe(false)
  })

  // protects INFRA-006
  it("also rejects a payment that does not match the referenced invoice", () => {
    const verdict = checkSettledAmount({
      expected: 50000,
      settled: 50000,
      invoiceAmount: 25000,
    })
    expect(verdict.ok).toBe(false)
    expect(verdict.reason).toContain("Invoice mismatch")
  })

  // protects INFRA-006
  it("accepts a payment that matches both the charge and the invoice", () => {
    const verdict = checkSettledAmount({
      expected: 50000,
      settled: 50000,
      invoiceAmount: 50000,
    })
    expect(verdict.ok).toBe(true)
  })

  // protects INFRA-006
  it("describes the mismatch for the operator", () => {
    expect(amountMismatchMessage(50000, 1)).toContain("50000")
    expect(amountMismatchMessage(50000, 1)).toContain("NOT marked paid")
  })
})

// ---------------------------------------------------------------------------
// INFRA-007 — the mock transport must be unreachable in production
// ---------------------------------------------------------------------------

describe("INFRA-007: the sandbox mock can never approve a payment in production", () => {
  // protects INFRA-007
  it("treats an absent MPESA_ENV as production, never as sandbox", () => {
    setEnv({ MPESA_ENV: undefined })
    const cfg = darajaConfig()
    expect(cfg.env).toBe("production")
    expect(cfg.sandbox).toBe(false)
    expect(cfg.baseUrl).toContain("api.safaricom.co.ke")
  })

  // protects INFRA-007
  it("treats a blank MPESA_ENV as production, never as sandbox", () => {
    setEnv({ MPESA_ENV: "   " })
    const cfg = darajaConfig()
    expect(cfg.env).toBe("production")
    expect(cfg.sandbox).toBe(false)
  })

  // protects INFRA-007
  it("only the exact value 'sandbox' selects the Daraja sandbox", () => {
    setEnv({ MPESA_ENV: "sandbox" })
    expect(darajaConfig().env).toBe("sandbox")
    expect(darajaConfig().baseUrl).toContain("sandbox.safaricom.co.ke")

    setEnv({ MPESA_ENV: "Sandbox" })
    expect(darajaConfig().env).toBe("sandbox")

    setEnv({ MPESA_ENV: "production" })
    expect(darajaConfig().env).toBe("production")
    expect(darajaConfig().sandbox).toBe(false)

    setEnv({ MPESA_ENV: "staging" })
    expect(darajaConfig().env).toBe("production")
  })

  // protects INFRA-007
  it("disables the mock transport when NODE_ENV is production", () => {
    setEnv({ MPESA_SANDBOX_MOCK: "1", NODE_ENV: "production" })
    expect(darajaMockMode()).toBe(false)
    expect(darajaConfig().mockBlocked).toBe(true)
  })

  // protects INFRA-007
  it("disables the mock transport when the flag is not exactly '1'", () => {
    setEnv({ MPESA_SANDBOX_MOCK: "true", NODE_ENV: "development" })
    expect(darajaMockMode()).toBe(false)
    setEnv({ MPESA_SANDBOX_MOCK: undefined, NODE_ENV: "development" })
    expect(darajaMockMode()).toBe(false)
  })

  // protects INFRA-007
  it("enables the mock transport only in a development/test runtime", () => {
    setEnv({ MPESA_SANDBOX_MOCK: "1", NODE_ENV: "development" })
    expect(darajaMockMode()).toBe(true)
    setEnv({ NODE_ENV: "test" })
    expect(darajaMockMode()).toBe(true)
  })

  // protects INFRA-007
  it("refuses a runtime that does not declare NODE_ENV at all", () => {
    setEnv({ MPESA_SANDBOX_MOCK: "1", NODE_ENV: undefined })
    expect(isMockEnvironment(undefined)).toBe(false)
    expect(darajaMockMode()).toBe(false)
  })

  // protects INFRA-007
  it("reports the platform as unable to take a payment when the mock flag is set in production", () => {
    setEnv({
      MPESA_SANDBOX_MOCK: "1",
      NODE_ENV: "production",
      MPESA_CONSUMER_KEY: "key",
      MPESA_CONSUMER_SECRET: "secret",
      MPESA_SHORTCODE: "174379",
      MPESA_PASSKEY: "passkey",
      MPESA_CALLBACK_URL: "https://example.com/api/mpesa/callback",
    })
    expect(darajaConfigured()).toBe(false)
    expect(darajaPaymentsAvailable()).toBe(false)
  })

  // protects INFRA-007
  it("never returns a successful push or query from the mock transport in production", async () => {
    setEnv({ MPESA_SANDBOX_MOCK: "1", NODE_ENV: "production" })
    await expect(
      stkPush({ phone: "0712345678", amount: 100, accountReference: "RENT-1" }),
    ).rejects.toThrow(/mock mode is disabled/i)
    await expect(stkQuery("ws_CO_123")).rejects.toThrow(/mock mode is disabled/i)
  })

  // protects INFRA-007
  it("still allows the mock transport in a development runtime", async () => {
    setEnv({ MPESA_SANDBOX_MOCK: "1", NODE_ENV: "development" })
    const push = await stkPush({ phone: "0712345678", amount: 100, accountReference: "RENT-1" })
    expect(push.ResponseCode).toBe("0")
    expect(push.mocked).toBe(true)
    const query = await stkQuery("ws_CO_123")
    expect(query.ResultCode).toBe("0")
    expect(query.mocked).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// AUTHZ-005 — only a platform operator may re-point the Daraja URLs
// ---------------------------------------------------------------------------

describe("AUTHZ-005: the Daraja URL registration is an operator action", () => {
  // protects AUTHZ-005
  it("authorises nobody while MPESA_ADMIN_EMAILS is unset", () => {
    expect(mpesaAdminEmails()).toEqual([])
    expect(isMpesaAdminEmail("ops@propdesk.africa")).toBe(false)
    expect(isMpesaAdminEmail(null)).toBe(false)
  })

  // protects AUTHZ-005
  it("authorises only the listed addresses", () => {
    setEnv({ MPESA_ADMIN_EMAILS: " ops@propdesk.africa , finance@propdesk.africa " })
    expect(mpesaAdminEmails()).toEqual(["ops@propdesk.africa", "finance@propdesk.africa"])
    expect(isMpesaAdminEmail("ops@propdesk.africa")).toBe(true)
    expect(isMpesaAdminEmail("OPS@PropDesk.Africa")).toBe(true)
    expect(isMpesaAdminEmail("landlord@example.com")).toBe(false)
    expect(isMpesaAdminEmail("")).toBe(false)
  })
})
