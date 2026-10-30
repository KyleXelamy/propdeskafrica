/**
 * Shared system health probe.
 *
 * One implementation, three consumers:
 *   - GET /api/system/ping          (public machine-readable probe)
 *   - /status                       (public status page)
 *   - /dashboard/settings/system    (workspace health screen)
 *
 * Before this existed the status page hardcoded `allOperational = true` and
 * the settings page hardcoded "Everything is up to date", so both screens
 * reported success even when the database was unreachable.
 *
 * Server-only: this module imports the database drivers.
 */
import { neonConfigured, getDb } from "@/lib/db/neon"
import { createClient } from "@/lib/supabase/server"

export interface SystemHealth {
  /** True only when the database answered the version check. */
  ok: boolean
  db: "neon" | "supabase"
  latency_ms: number
  schema_version: string | null
  db_error?: string
  timestamp: string
}

export async function checkSystemHealth(): Promise<SystemHealth> {
  const started = Date.now()
  const db = neonConfigured() ? "neon" : "supabase"
  let schemaVersion: string | null = null
  let dbError: string | undefined

  try {
    if (neonConfigured()) {
      const sql = getDb()
      const rows = (await sql.unsafe(
        `select schema_version::text as v from public.system_version where id = 1`,
      )) as unknown as Array<{ v: string | null }>
      schemaVersion = rows[0]?.v ?? null
    } else {
      const supa = await createClient()
      const { data, error } = await supa
        .from("system_version")
        .select("schema_version")
        .eq("id", 1)
        .maybeSingle()
      if (error) {
        dbError = error.message
      } else if (data) {
        schemaVersion = String(data.schema_version)
      }
    }
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err)
    console.error("[system-health] database check failed", err)
  }

  return {
    ok: schemaVersion !== null,
    db,
    latency_ms: Date.now() - started,
    schema_version: schemaVersion,
    db_error: dbError,
    timestamp: new Date().toISOString(),
  }
}
