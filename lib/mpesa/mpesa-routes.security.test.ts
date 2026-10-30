import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

/**
 * Route-level regression tests for the M-Pesa callback hardening.
 *
 *   INFRA-004 / AUTHZ-011 — the C2B callbacks must reject an unconfigured
 *                            IP allowlist instead of accepting everyone.
 *   INFRA-005             — the STK callback must not trust the
 *                            client-controllable x-forwarded-for header.
 *   AUTHZ-005             — only a platform operator may re-point the
 *                            platform's Daraja URLs.
 *
 * Hermetic: no network, no database, no real Supabase. Only the
 * authentication gates are exercised — every case below is decided before
 * the handler touches the database.
 */

const session = vi.hoisted(() => ({ email: null as string | null }))

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: true,
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: session.email ? { id: "user-1", email: session.email } : null },
        error: null,
      }),
    },
  }),
}))

const SAVED_ENV = { ...process.env }

function setEnv(values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

function post(path: string, headers: Record<string, string> = {}, body?: unknown) {
  const init: ConstructorParameters<typeof NextRequest>[1] = {
    method: "POST",
    headers: { host: "app.propdesk.africa", origin: "https://app.propdesk.africa", ...headers },
  }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
    init.headers = { ...(init.headers as Record<string, string>), "content-type": "application/json" }
  }
  return new NextRequest(`https://app.propdesk.africa${path}`, init)
}

beforeEach(() => {
  session.email = null
  setEnv({
    MPESA_ENV: undefined,
    MPESA_SANDBOX_MOCK: undefined,
    MPESA_CALLBACK_SECRET: undefined,
    MPESA_ALLOWED_CALLBACK_IPS: undefined,
    MPESA_ADMIN_EMAILS: undefined,
    NEXT_PUBLIC_SUPABASE_URL: undefined,
    SUPABASE_SERVICE_ROLE_KEY: undefined,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
    NODE_ENV: "test",
  })
})

afterEach(() => {
  process.env = { ...SAVED_ENV }
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// INFRA-004 / AUTHZ-011 — the C2B callbacks
// ---------------------------------------------------------------------------

describe("INFRA-004: the C2B callbacks fail closed", () => {
  // protects INFRA-004
  it("rejects the C2B confirmation when the IP allowlist is not configured", async () => {
    const { POST } = await import("../../app/api/mpesa/c2b/confirmation/route")
    const res = await POST(post("/api/mpesa/c2b/confirmation"))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ ResultCode: 1, ResultDesc: "Forbidden" })
  })

  // protects INFRA-004
  it("rejects the C2B validation when the IP allowlist is not configured", async () => {
    const { POST } = await import("../../app/api/mpesa/c2b/validation/route")
    const res = await POST(post("/api/mpesa/c2b/validation"))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ ResultCode: "C2B00012", ResultDesc: "Forbidden" })
  })

  // protects INFRA-004
  it("rejects a C2B callback that only spoofs x-forwarded-for", async () => {
    setEnv({ MPESA_ALLOWED_CALLBACK_IPS: "196.201.214.10" })
    const { POST } = await import("../../app/api/mpesa/c2b/confirmation/route")
    const res = await POST(post("/api/mpesa/c2b/confirmation", { "x-forwarded-for": "196.201.214.10" }))
    expect(res.status).toBe(403)
  })

  // protects INFRA-004
  it("lets an allowlisted, platform-identified C2B callback through the gate", async () => {
    setEnv({ MPESA_ALLOWED_CALLBACK_IPS: "196.201.214.10" })
    const { POST } = await import("../../app/api/mpesa/c2b/confirmation/route")
    // Past the gate the handler parses the body; an empty body is a 400 —
    // which proves the authentication gate let the request through.
    const res = await POST(post("/api/mpesa/c2b/confirmation", { "x-vercel-forwarded-for": "196.201.214.10" }))
    expect(res.status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// INFRA-005 — the STK callback
// ---------------------------------------------------------------------------

describe("INFRA-005: the STK callback authenticates with the shared secret", () => {
  // protects INFRA-005
  it("refuses to run at all when no callback secret is configured", async () => {
    const { POST } = await import("../../app/api/mpesa/callback/route")
    const res = await POST(post("/api/mpesa/callback"))
    expect(res.status).toBe(503)
    expect((await res.json()).ResultDesc).toBe("Callback secret is not configured")
  })

  // protects INFRA-005
  it("rejects a callback with the wrong secret", async () => {
    setEnv({ MPESA_CALLBACK_SECRET: "s3cr3t-callback-secret" })
    const { POST } = await import("../../app/api/mpesa/callback/route")
    const res = await POST(post("/api/mpesa/callback", { "x-mpesa-callback-secret": "wrong" }))
    expect(res.status).toBe(403)
    expect((await res.json()).ResultDesc).toBe("Rejected")
  })

  // protects INFRA-005
  it("rejects a callback that only spoofs x-forwarded-for", async () => {
    setEnv({
      MPESA_CALLBACK_SECRET: "s3cr3t-callback-secret",
      MPESA_ALLOWED_CALLBACK_IPS: "196.201.214.10",
    })
    const { POST } = await import("../../app/api/mpesa/callback/route")
    const res = await POST(
      post("/api/mpesa/callback", {
        "x-mpesa-callback-secret": "s3cr3t-callback-secret",
        "x-forwarded-for": "196.201.214.10",
      }),
    )
    expect(res.status).toBe(403)
  })

  // protects INFRA-005
  it("accepts a correctly authenticated callback", async () => {
    setEnv({
      MPESA_CALLBACK_SECRET: "s3cr3t-callback-secret",
      MPESA_ALLOWED_CALLBACK_IPS: "196.201.214.10",
    })
    const { POST } = await import("../../app/api/mpesa/callback/route")
    const res = await POST(
      post(
        "/api/mpesa/callback",
        {
          "x-mpesa-callback-secret": "s3cr3t-callback-secret",
          "x-vercel-forwarded-for": "196.201.214.10",
        },
        { Body: { stkCallback: { CheckoutRequestID: "ws_CO_1", MerchantRequestID: "m-1", ResultCode: 0 } } },
      ),
    )
    // Past the authentication gate the handler needs the Supabase service
    // key; without it the answer is a 500 "Server misconfigured", which
    // proves the gate let the request through.
    expect(res.status).toBe(500)
    expect((await res.json()).ResultDesc).toBe("Server misconfigured")
  })
})

// ---------------------------------------------------------------------------
// AUTHZ-005 — the Daraja URL registration is an operator action
// ---------------------------------------------------------------------------

describe("AUTHZ-005: only a platform operator may register Daraja URLs", () => {
  // withAuth expects the Next.js route context.
  const ctx = { params: Promise.resolve({}) }

  // protects AUTHZ-005
  it("refuses to run while MPESA_ADMIN_EMAILS is unset", async () => {
    session.email = "ops@propdesk.africa"
    const { POST } = await import("../../app/api/mpesa/c2b/register/route")
    const res = await POST(
      post(
        "/api/mpesa/c2b/register",
        {},
        {
          short_code: "174379",
          response_type: "Completed",
          validation_url: "https://app.propdesk.africa/api/mpesa/c2b/validation",
          confirmation_url: "https://app.propdesk.africa/api/mpesa/c2b/confirmation",
        },
      ),
      ctx,
    )
    expect(res.status).toBe(503)
  })

  // protects AUTHZ-005
  it("rejects a signed-in user who is not an operator", async () => {
    setEnv({ MPESA_ADMIN_EMAILS: "ops@propdesk.africa" })
    session.email = "landlord@example.com"
    const { POST } = await import("../../app/api/mpesa/c2b/register/route")
    const res = await POST(
      post(
        "/api/mpesa/c2b/register",
        {},
        {
          short_code: "174379",
          response_type: "Completed",
          validation_url: "https://app.propdesk.africa/api/mpesa/c2b/validation",
          confirmation_url: "https://app.propdesk.africa/api/mpesa/c2b/confirmation",
        },
      ),
      ctx,
    )
    expect(res.status).toBe(403)
  })

  // protects AUTHZ-005
  it("lets an operator through to the request validation", async () => {
    setEnv({ MPESA_ADMIN_EMAILS: "ops@propdesk.africa" })
    session.email = "ops@propdesk.africa"
    const { POST } = await import("../../app/api/mpesa/c2b/register/route")
    const res = await POST(
      post(
        "/api/mpesa/c2b/register",
        {},
        {
          short_code: "not-a-shortcode",
          response_type: "Completed",
          validation_url: "https://app.propdesk.africa/api/mpesa/c2b/validation",
          confirmation_url: "https://app.propdesk.africa/api/mpesa/c2b/confirmation",
        },
      ),
      ctx,
    )
    // 400 (schema) rather than 403 (authorisation) — the operator gate passed.
    expect(res.status).toBe(400)
  })

  // protects AUTHZ-005
  it("registers the URLs for an operator", async () => {
    setEnv({ MPESA_ADMIN_EMAILS: "ops@propdesk.africa" })
    session.email = "ops@propdesk.africa"
    // The mock transport keeps the test hermetic — no Daraja call is made.
    setEnv({ MPESA_SANDBOX_MOCK: "1", NODE_ENV: "test" })
    const { POST } = await import("../../app/api/mpesa/c2b/register/route")
    const res = await POST(
      post(
        "/api/mpesa/c2b/register",
        {},
        {
          short_code: "174379",
          response_type: "Completed",
          validation_url: "https://app.propdesk.africa/api/mpesa/c2b/validation",
          confirmation_url: "https://app.propdesk.africa/api/mpesa/c2b/confirmation",
        },
      ),
      ctx,
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.daraja.ResponseCode).toBe("0")
  })
})
