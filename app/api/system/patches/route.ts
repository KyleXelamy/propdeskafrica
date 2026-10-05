import { NextResponse } from "next/server"
import { describePatches } from "@/lib/system"

export const runtime = "nodejs"

/**
 * GET /api/system/patches
 * Public list of every patch the platform knows about. Used by the
 * dashboard to show "what could be applied" and to power the changelog.
 */
export function GET() {
  const patches = describePatches()
  return NextResponse.json({ count: patches.length, patches })
}