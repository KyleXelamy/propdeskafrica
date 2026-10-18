import { NextResponse } from "next/server"
export const dynamic = "force-dynamic"

/** Public liveness probe. Never disclose providers, configuration, or secrets. */
export async function GET() {
  return NextResponse.json({ status: "ok" })
}
