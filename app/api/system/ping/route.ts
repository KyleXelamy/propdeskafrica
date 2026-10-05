import { NextResponse } from "next/server"
import { neonConfigured, getDb } from "@/lib/db/neon"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

/**
 * GET /api/system/ping
 * Public — actually touches the database. Returns latency, not just "the process is alive".
 * Used by the system info card and any external monitor.
 */
export async function GET() {
  const started = Date.now()
  const db = neonConfigured() ? "neon" : "supabase"
  let dbOk = false
  let dbError: string | undefined
  let versionInfo: string | undefined
  try {
    if (neonConfigured()) {
      const sql = getDb()
      const rows = (await sql.unsafe(`select schema_version::text as v, last_patch_id as p from public.system_version where id = 1`)) as unknown as any[]
      versionInfo = rows[0]?.v
      dbOk = true
    } else {
      const supa = await createClient()
      const { data, error } = await supa.from("system_version").select("schema_version").eq("id", 1).maybeSingle()
      if (!error && data) {
        versionInfo = String(data.schema_version)
        dbOk = true
      } else if (error) {
        dbError = error.message
      }
    }
  } catch (err) {
    dbError = err instanceof Error ? err.message : "ping failed"
  }
  return NextResponse.json(
    {
      ok: dbOk,
      db,
      latency_ms: Date.now() - started,
      schema_version: versionInfo,
      db_error: dbError,
      timestamp: new Date().toISOString(),
    },
    { status: dbOk ? 200 : 503 },
  )
}
