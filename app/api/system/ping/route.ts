import { NextResponse } from "next/server"
import { checkSystemHealth } from "@/lib/system-health"

export const runtime = "nodejs"

/**
 * GET /api/system/ping
 *
 * Public — actually touches the database. Returns latency, not just "the process is alive".
 * Used by the system info card and any external monitor.
 *
 * The probe itself lives in lib/system-health.ts so the /status page and the
 * dashboard settings screen report exactly the same numbers.
 */
export async function GET() {
  const health = await checkSystemHealth()
  // NOTE: this route is public and unauthenticated. It must NOT return
  // `health.db_error` — a raw driver error can carry the database host,
  // database name, schema and table names. That detail belongs in the
  // server log and on the authenticated dashboard screen, not in a response
  // anyone on the internet can hit. See lib/system-health.ts.
  return NextResponse.json(
    {
      ok: health.ok,
      db: health.db,
      latency_ms: health.latency_ms,
      schema_version: health.schema_version ?? undefined,
      timestamp: health.timestamp,
    },
    { status: health.ok ? 200 : 503 },
  )
}
