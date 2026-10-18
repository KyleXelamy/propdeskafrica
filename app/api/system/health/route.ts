import { NextResponse } from "next/server"
export const runtime = "nodejs"

/** Public liveness probe. Keep infrastructure and version details private. */
export async function GET() {
  return NextResponse.json({ ok: true })
}
