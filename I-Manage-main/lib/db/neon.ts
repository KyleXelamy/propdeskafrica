/**
 * Neon Postgres client.
 *
 * I-Manage uses Neon as the primary database (via the @neondatabase/serverless
 * HTTP driver). Supabase is retained ONLY for:
 *   - Auth (sessions, cookies, getUser) — see lib/supabase/server.ts
 *   - Storage (avatars, documents, property photos)
 *
 * If `DATABASE_URL` is set, the app uses Neon.
 * If `DATABASE_URL` is missing, the app falls back to the legacy Supabase
 * Postgres path (via lib/supabase/server.ts) — useful for local dev and for
 * any existing Supabase-only deployments.
 *
 * Why HTTP over TCP? The Neon serverless driver is a single fetch call, no
 * connection pooling, no cold start penalty. Works in Edge runtime, Vercel
 * serverless, Cloudflare Workers, plain Node. Trade-off: one shot per call,
 * so for batched writes use `sql.transaction([...])`.
 */
import { neon, neonConfig, type NeonQueryFunction } from "@neondatabase/serverless"

let cachedSql: NeonQueryFunction<false, false> | null = null

export function getDbUrl(): string | null {
  return process.env.DATABASE_URL || null
}

export function neonConfigured(): boolean {
  return Boolean(getDbUrl())
}

/**
 * Returns the Neon query function (template literal form). Throws a clear
 * error if `DATABASE_URL` is not set.
 *
 * Cached at module scope so the HTTP client is reused across requests in the
 * same server process. Safe to call from server components, server actions,
 * and API route handlers.
 */
export function getDb(): NeonQueryFunction<false, false> {
  if (cachedSql) return cachedSql
  const url = getDbUrl()
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env.local (Neon connection string " +
        "from https://console.neon.tech), or unset NEON_ENABLED to fall back to Supabase.",
    )
  }
  // In Node 21 and below we need to provide a WebSocket constructor for any
  // code path that uses Pool/Client. Our default code only uses the HTTP
  // `neon()` template form, so this is a no-op for us — but set it for
  // safety in case a future module uses Pool.
  if (typeof WebSocket === "undefined") {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    try { neonConfig.webSocketConstructor = require("ws") } catch { /* ignore */ }
  }
  cachedSql = neon(url)
  return cachedSql
}

/**
 * Run a parameterized query. Returns the rows array. Use this for one-shot
 * SELECT / INSERT / UPDATE / DELETE.
 *
 * Example:
 *   const properties = await query<Property>(
 *     "SELECT * FROM properties WHERE user_id = $1",
 *     [userId],
 *   )
 */
export async function query<T = any>(
  text: string,
  params: any[] = [],
): Promise<T[]> {
  // Use the safe parameterized query() API. Avoid string interpolation.
  const sql = getDb()
  const result = await sql.query(text, params)
  return result as unknown as T[]
}

/**
 * Run multiple statements inside a single non-interactive transaction. All
 * statements execute atomically; on error, all are rolled back.
 *
 * Example:
 *   const [inserted, updated] = await tx([
 *     sql`INSERT INTO ...`,
 *     sql`UPDATE ... SET ...`,
 *   ])
 */
export async function tx<T extends readonly unknown[] = any[]>(
  queries: [...{ [K in keyof T]: any }],
): Promise<T> {
  const sql = getDb()
  return (await sql.transaction(queries as any)) as T
}

/**
 * Convenience helper for "get one row or null" — saves a [0]?. dance.
 */
export async function queryOne<T = any>(
  text: string,
  params: any[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params)
  return rows[0] ?? null
}

/**
 * Ping the database. Returns ms round-trip or throws. Used by /api/health.
 */
export async function pingDb(): Promise<{ ok: true; ms: number } | { ok: false; error: string }> {
  const t0 = Date.now()
  try {
    const sql = getDb()
    await sql`SELECT 1 AS ok`
    return { ok: true, ms: Date.now() - t0 }
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) }
  }
}
