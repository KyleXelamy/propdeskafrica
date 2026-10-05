/**
 * withDbAuth — auth via Supabase, data via Neon.
 *
 * Same shape as withAuth() but routes all DB work through the Neon HTTP
 * driver instead of the Supabase JS client. Use this for any route that
 * wants to be fully Neon-native (no Supabase JS in the hot path).
 *
 * The route handler receives:
 *   - sql    — Neon template literal query function
 *   - userId — authenticated user id (uuid)
 *   - user   — Supabase user object (email, etc.)
 *   - params — dynamic route params
 *
 * The handler must explicitly scope every query by `userId` — there's no
 * RLS on Neon, so the application code carries that responsibility.
 */
import { NextRequest, NextResponse } from "next/server"
import { getDb, neonConfigured } from "@/lib/db/neon"
import { createClient } from "@/lib/supabase/server"

export class DbHttpError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

type DbAuthHandler = (
  req: NextRequest,
  ctx: { user: any; userId: string; sql: ReturnType<typeof getDb> },
  params: Record<string, string>,
) => Promise<NextResponse | any> | NextResponse | any

interface Options {
  /** Allowed HTTP methods. Defaults to GET, POST, PUT, PATCH, DELETE. */
  methods?: string[]
  /** If true, also require same-origin Origin/Referer for non-GET requests. */
  csrf?: boolean
}

function getOriginHost(req: NextRequest): string | null {
  try {
    const url = new URL(req.url)
    return url.host
  } catch { return null }
}

function isSameOrigin(req: NextRequest): boolean {
  const host = getOriginHost(req)
  if (!host) return false
  const origin = req.headers.get("origin")
  if (origin) {
    try {
      return new URL(origin).host === host
    } catch { return false }
  }
  const referer = req.headers.get("referer")
  if (referer) {
    try {
      return new URL(referer).host === host
    } catch { return false }
  }
  return false
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export function withDbAuth(handler: DbAuthHandler, opts: Options = {}) {
  const allowed = new Set((opts.methods ?? ["GET", "POST", "PUT", "PATCH", "DELETE"]).map((m) => m.toUpperCase()))
  return async (req: NextRequest, routeCtx?: { params: Record<string, string> }) => {
    const method = req.method.toUpperCase()
    if (!allowed.has(method)) {
      return jsonError(`Method ${method} not allowed`, 405)
    }
    if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
      if (opts.csrf !== false && !isSameOrigin(req)) {
        return jsonError("Forbidden: cross-origin request rejected", 403)
      }
    }
    if (!neonConfigured()) {
      return jsonError(
        "DATABASE_URL is not configured. Add it to .env.local (Neon) " +
          "or remove withDbAuth to fall back to the Supabase path.",
        500,
      )
    }
    // Auth via Supabase (cookie-based, getUser = server-validated)
    const supabase = await createClient()
    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) {
      return jsonError("Unauthorized", 401)
    }
    try {
      const result = await handler(
        req,
        { user, userId: user.id, sql: getDb() },
        routeCtx?.params || {},
      )
      if (result instanceof NextResponse) return result
      if (result === undefined || result === null) return NextResponse.json({})
      if (typeof result === "object" && "ok" in result) return NextResponse.json(result)
      return NextResponse.json({ data: result })
    } catch (e: any) {
      if (e instanceof DbHttpError) return jsonError(e.message, e.status)
      console.error("[i-manage] withDbAuth handler error", e)
      return jsonError(e?.message || "Internal error", 500)
    }
  }
}
