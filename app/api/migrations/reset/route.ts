import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { neonConfigured, getDb } from "@/lib/db/neon"
import { PATCH_LOG } from "@/lib/system"
import { z } from "zod"

export const runtime = "nodejs"

/**
 * POST /api/migrations/reset
 * Body: { patch_id: string, mode?: "applied" | "failed" | "missing" }
 *
 * Manually toggles a patch's bookkeeping so the runner can retry it.
 * This is the recovery path for "13 failed and 1 missed" scenarios:
 *
 *   1. The patches table records all patches as applied.
 *   2. But the SQL itself failed (e.g. pg_cron on plain Postgres).
 *   3. So subsequent migrations never ran.
 *
 * To recover:
 *   - First reset status=failed for any p_2026_10_* patches you want to retry.
 *     Then POST /api/migrations/run with the patch_ids.
 *   - For "missed" patches: just call /api/migrations/run with patch_ids, the
 *     runner only skips rows that are recorded as applied.
 *
 * Auth: requires either MIGRATION_SECRET header OR a logged-in user.
 */
const Schema = z.object({
  patch_id: z.string().min(1),
  mode: z.enum(["applied", "failed", "missing"]).default("missing"),
})

/**
 * Returns an error response to send back, or null when access is allowed.
 *
 * Previously any signed-in user could flip patch bookkeeping for the whole
 * platform. In production this now requires MIGRATION_SECRET; the
 * logged-in-user path is dev-only.
 */
async function checkAccess(request: NextRequest): Promise<NextResponse | null> {
  const expected = process.env.MIGRATION_SECRET
  const got = request.headers.get("x-migration-secret")
    ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  if (expected && got === expected) return null

  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: expected ? "Forbidden" : "MIGRATION_SECRET must be configured in production" },
      { status: expected ? 403 : 503 },
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user ? null : NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

export async function POST(request: NextRequest) {
  const denied = await checkAccess(request)
  if (denied) return denied
  const parse = Schema.safeParse(await request.json().catch(() => ({})))
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.issues[0]?.message ?? "Invalid input" }, { status: 400 })
  }

  const { patch_id, mode } = parse.data
  if (!PATCH_LOG.some((p) => p.id === patch_id)) {
    return NextResponse.json({ error: `Unknown patch_id: ${patch_id}` }, { status: 400 })
  }

  if (mode === "missing") {
    // No-op — just check
    return NextResponse.json({
      ok: true,
      action: "noop (missing patches are auto-detected by the runner)",
      patch_id,
    })
  }

  if (neonConfigured()) {
    const sql = getDb()
    if (mode === "applied") {
      // Mark as applied (idempotent)
      await (sql as any).unsafe(
        `insert into public.patches (id, description, kind, applied_by) values ($1, $2, 'schema', 'manual-reset') on conflict (id) do nothing`,
        [patch_id, "manually marked applied via reset"],
      )
    } else if (mode === "failed") {
      // Remove from patches table so the runner will retry
      await (sql as any).unsafe(`delete from public.patches where id = $1`, [patch_id])
    }
  } else {
    const supa = await createClient()
    if (mode === "applied") {
      await supa.from("patches").upsert({
        id: patch_id,
        description: "manually marked applied via reset",
        kind: "schema",
        applied_by: "manual-reset",
      })
    } else if (mode === "failed") {
      await supa.from("patches").delete().eq("id", patch_id)
    }
  }

  return NextResponse.json({ ok: true, action: mode, patch_id })
}