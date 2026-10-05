import { NextResponse } from "next/server"
import { APP_COMMIT, APP_NAME, APP_VERSION, CURRENT_SCHEMA_VERSION } from "@/lib/system"

export const runtime = "nodejs"

/**
 * GET /api/system/version
 * Returns the app + schema version. No auth — the dashboard pings this
 * during boot to surface "your schema is out of date" before login.
 */
export function GET() {
  return NextResponse.json({
    app: {
      name: APP_NAME,
      version: APP_VERSION,
      commit: APP_COMMIT,
    },
    schema: {
      current: CURRENT_SCHEMA_VERSION,
    },
    node: process.version,
    timestamp: new Date().toISOString(),
  })
}