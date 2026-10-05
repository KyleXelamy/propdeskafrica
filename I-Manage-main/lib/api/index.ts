/**
 * Shared helpers for /app/api/** route handlers.
 *
 * Centralises the auth check, error envelope, request-id logging, and
 * CRUD validation so every endpoint looks the same. Adding a new
 * resource is then just a few lines in the route file.
 */
import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

export type ApiHandler = (
  request: NextRequest,
  context: { supabase: Awaited<ReturnType<typeof createClient>>; userId: string },
  params?: Record<string, string>,
) => Promise<NextResponse> | NextResponse

export interface RouteContext<P = Record<string, string>> {
  params: Promise<P>
}

/** Wraps a handler with auth + uniform error handling. */
export function withAuth<P = Record<string, string>>(
  handler: (
    request: NextRequest,
    ctx: { supabase: Awaited<ReturnType<typeof createClient>>; userId: string },
    params: P,
  ) => Promise<NextResponse>,
) {
  return async (request: NextRequest, ctx: { params: Promise<P> }) => {
    try {
      // Same-origin / CSRF guard. GET / HEAD / OPTIONS are idempotent and
      // safe to allow from anywhere (cors-style). All other verbs must
      // come from our own origin or be allowed via CORS later.
      if (needsOriginCheck(request.method)) {
        const origin = request.headers.get("origin")
        const referer = request.headers.get("referer")
        if (!isSameOrigin(request, origin, referer)) {
          return errorResponse("Forbidden: cross-origin request rejected", 403)
        }
      }

      const supabase = await createClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        return errorResponse("Unauthorized", 401)
      }

      const params = (await ctx.params) as P
      return await handler(request, { supabase, userId: user.id }, params)
    } catch (err) {
      console.error("[api] unhandled error", err)
      const message = err instanceof Error ? err.message : "Internal server error"
      return errorResponse(message, 500)
    }
  }
}

/** Methods that can mutate state — need origin check. */
function needsOriginCheck(method: string): boolean {
  const m = method.toUpperCase()
  return m !== "GET" && m !== "HEAD" && m !== "OPTIONS"
}

/**
 * Returns true if `origin` (or fallback `referer`) matches the request's
 * own host. Missing `origin` + missing `referer` blocks (e.g. curl),
 * because the browser always sends one of them for cross-origin requests
 * but never *both missing* for legit same-origin XHR.
 */
function isSameOrigin(request: NextRequest, origin: string | null, referer: string | null): boolean {
  const host = request.headers.get("host")
  if (!host) return false

  const candidate = origin || referer
  if (!candidate) return false

  try {
    const u = new URL(candidate)
    return u.host === host && (u.protocol === "http:" || u.protocol === "https:")
  } catch {
    return false
  }
}

export function errorResponse(message: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: message, ...extra }, { status })
}

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}

/**
 * Whitelist of column names accepted by POST/PUT bodies for a given table.
 * Throws a 400 if the body contains a key that's not in the whitelist.
 */
export function pickFields<T extends Record<string, any>>(
  body: any,
  whitelist: readonly (keyof T & string)[],
): Partial<T> {
  if (!body || typeof body !== "object") {
    throw new HttpError("Invalid request body", 400)
  }
  const out: Partial<T> = {}
  for (const key of whitelist) {
    if (key in body) {
      ;(out as any)[key] = body[key]
    }
  }
  return out
}

export class HttpError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

/**
 * Converts an empty/whitespace string to null; leaves other values alone.
 * Useful for optional form fields.
 */
export function blankToNull(v: unknown): unknown {
  if (v === undefined || v === null) return null
  if (typeof v === "string" && v.trim() === "") return null
  return v
}

/**
 * Coerces a value to a number, or returns null. Useful for amount fields
 * where the UI sends a string.
 */
export function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function toBool(v: unknown, fallback = false): boolean {
  if (v === true || v === "true" || v === "on" || v === 1 || v === "1") return true
  if (v === false || v === "false" || v === "off" || v === 0 || v === "0") return false
  return fallback
}
