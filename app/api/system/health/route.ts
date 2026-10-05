import { NextResponse } from "next/server"
import { APP_NAME, APP_VERSION } from "@/lib/system"
import { neonConfigured } from "@/lib/db/neon"

export const runtime = "nodejs"

/**
 * GET /api/system/health
 * Lightweight liveness probe used by the dashboard. No auth.
 * Returns: { ok, app, db, version, timestamp }
 */
export async function GET() {
  let db: "neon" | "supabase" | "unconfigured" = "unconfigured"
  if (neonConfigured()) db = "neon"
  else db = "supabase"
  return NextResponse.json({
    ok: true,
    app: APP_NAME,
    version: APP_VERSION,
    db,
    timestamp: new Date().toISOString(),
  })
}