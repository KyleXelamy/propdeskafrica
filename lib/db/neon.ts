/**
 * Neon Postgres client.
 *
 * PropDesk Africa uses Neon as the primary database (via the @neondatabase/serverless
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
  // Vercel’s managed Postgres integration exposes POSTGRES_URL rather than
  // DATABASE_URL. Keep DATABASE_URL supported for local and legacy installs.
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || null
}

export function neonConfigured(): boolean {
  return Boolean(getDbUrl())
}

/**
 * Return the cached Neon SQL client, creating it lazily from the configured URL.
 */
export function getDb(): NeonQueryFunction<false, false> {
  if (cachedSql) return cachedSql
  const url = getDbUrl()
  if (!url) throw new Error("Neon database is not configured")
  cachedSql = neon(url)
  return cachedSql
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
