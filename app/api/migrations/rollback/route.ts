import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { neonConfigured, getDb } from "@/lib/db/neon"
import { createClient } from "@/lib/supabase/server"
import { PATCH_LOG } from "@/lib/system"

export const runtime = "nodejs"

/**
 * POST /api/migrations/rollback
 *
 * Reverses a patch. The patch log in `lib/system.ts` may declare a
 * companion `<id>.rollback.sql` file alongside the original SQL; if
 * present, that's executed. Otherwise we just remove the patch from
 * the `patches` table and decrement the schema version — the user
 * is then expected to re-run the patch on top of their database if
 * they need it.
 *
 * Gated by `MIGRATION_SECRET` or, in dev, the same `x-migration-secret`
 * header used by /api/migrations/run.
 */
const Schema = z.object({
  patch_id: z.string(),
  confirm: z.boolean().default(false),
})

function checkSecret(request: NextRequest) {
  const expected = process.env.MIGRATION_SECRET
  if (!expected) return true
  const got = request.headers.get("x-migration-secret") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  return got === expected
}

export async function POST(request: NextRequest) {
  if (!checkSecret(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const body = (await request.json().catch(() => ({}))) as z.infer<typeof Schema>
  const parse = Schema.safeParse(body)
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.issues[0]?.message ?? "Invalid input" }, { status: 400 })
  }
  if (!parse.data.confirm) {
    return NextResponse.json({ error: "Set confirm: true to acknowledge this will downgrade the schema version." }, { status: 400 })
  }

  const patch = PATCH_LOG.find((p) => p.id === parse.data.patch_id)
  if (!patch) {
    return NextResponse.json({ error: `Unknown patch ${parse.data.patch_id}` }, { status: 404 })
  }
  if (patch.reversible === false) {
    return NextResponse.json({ error: `Patch ${patch.id} is marked irreversible` }, { status: 409 })
  }

  // Try the companion rollback file first
  const rollbackFile = patch.sql ? patch.sql.replace(/\.sql$/, ".rollback.sql") : null
  let rollbackSql: string | null = null
  if (rollbackFile) {
    try {
      rollbackSql = await readFile(path.join(process.cwd(), "supabase-setup", rollbackFile), "utf8")
    } catch {/* no companion file — fine */}
  }

  let executed = false
  if (rollbackSql) {
    if (neonConfigured()) {
      const sql = getDb()
      await (sql as any).unsafe(rollbackSql)
      executed = true
    } else {
      const supa = await createClient()
      const { error } = await supa.rpc("exec_sql", { sql: rollbackSql })
      if (!error) executed = true
    }
  }

  // Remove the patch from the log and decrement schema version
  if (neonConfigured()) {
    const sql = getDb()
    await (sql as any).unsafe(`delete from public.patches where id = $1`, [patch.id])
    await (sql as any).unsafe(
      `update public.system_version set schema_version = greatest(schema_version - 1, 0), last_patch_id = null, installed_at = now() where id = 1`,
    )
  } else {
    const supa = await createClient()
    await supa.from("patches").delete().eq("id", patch.id)
  }

  return NextResponse.json({
    ok: true,
    patch_id: patch.id,
    rollback_executed: executed,
    note: executed
      ? "Rollback SQL was applied. Schema version decremented."
      : "No companion rollback file — the patch record was removed and schema version decremented. The schema changes (if any) remain in the DB; you may need to clean them up manually.",
  })
}
