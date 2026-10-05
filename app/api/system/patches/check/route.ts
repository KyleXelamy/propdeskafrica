import { NextResponse } from "next/server"
import { neonConfigured, getDb } from "@/lib/db/neon"
import { createClient } from "@/lib/supabase/server"
import { CURRENT_SCHEMA_VERSION, PATCH_LOG } from "@/lib/system"

export const runtime = "nodejs"

/**
 * GET /api/system/patches/check
 * Public — returns the list of patches that haven't been applied yet.
 * Drives the dashboard's "system update available" banner.
 */
export async function GET() {
  const applied = new Set<string>()

  if (neonConfigured()) {
    try {
      const sql = getDb()
      const rows = await sql.unsafe(`select id from public.patches`)
      for (const r of rows as unknown as any[]) applied.add(r.id)
    } catch {
      // ignore
    }
  } else {
    try {
      const supa = await createClient()
      const { data } = await supa.from("patches").select("id")
      for (const r of data ?? []) applied.add(r.id)
    } catch {
      // ignore
    }
  }

  const pending = PATCH_LOG.filter((p) => !applied.has(p.id))
  return NextResponse.json({
    current_schema_version: CURRENT_SCHEMA_VERSION,
    applied_count: applied.size,
    pending_count: pending.length,
    pending: pending.map((p) => ({ id: p.id, description: p.description, kind: p.kind ?? "schema" })),
  })
}
