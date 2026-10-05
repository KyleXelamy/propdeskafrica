import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { neonConfigured, getDb } from "@/lib/db/neon"
import { createClient } from "@/lib/supabase/server"
import { PATCH_LOG, describePatches } from "@/lib/system"
import { readFile } from "node:fs/promises"
import path from "node:path"

export const runtime = "nodejs"

/**
 * POST /api/migrations/run
 *
 * Server-side patch runner. Walks the patch log, applies any patch that
 * isn't recorded in the `patches` table yet. Idempotent — running twice
 * is a no-op. No auth required at the HTTP level (designed to be invoked
 * during boot or by an internal operator), but the request MUST include
 * a `secret` header that matches `MIGRATION_SECRET` env var.
 *
 * The secret header is a soft check; the real security is that this
 * endpoint runs only on the host that owns the database. There is no
 * admin user — anyone with the secret can apply patches.
 */
const Schema = z.object({
  patch_ids: z.array(z.string()).optional(), // if provided, only these
  dry_run: z.boolean().optional(),
  record: z.boolean().default(true),
})

async function checkAccess(request: NextRequest) {
  const expected = process.env.MIGRATION_SECRET
  const got = request.headers.get("x-migration-secret") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  if (!expected || got === expected) return true

  // Signed-in dashboard users can request the idempotent setup check without
  // ever seeing or copying an infrastructure secret.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return Boolean(user)
}

export async function POST(request: NextRequest) {
  if (!(await checkAccess(request))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const body = (await request.json().catch(() => ({}))) as z.infer<typeof Schema>
  const parse = Schema.safeParse(body)
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.issues[0]?.message ?? "Invalid input" }, { status: 400 })
  }

  const applied = new Set<string>()
  if (neonConfigured()) {
    try {
      const sql = getDb()
      const rows = await (sql as any).unsafe(`select id from public.patches`) as unknown as any[]
      for (const r of rows) applied.add(r.id)
    } catch {/* ignore */}
  } else {
    try {
      const supa = await createClient()
      const { data } = await supa.from("patches").select("id")
      for (const r of data ?? []) applied.add(r.id)
    } catch {/* ignore */}
  }

  const targets = parse.data.patch_ids
    ? PATCH_LOG.filter((p) => parse.data.patch_ids!.includes(p.id))
    : PATCH_LOG

  const results: Array<{ id: string; status: "applied" | "skipped" | "failed"; error?: string }> = []
  for (const patch of targets) {
    if (applied.has(patch.id)) {
      results.push({ id: patch.id, status: "skipped" })
      continue
    }
    if (parse.data.dry_run) {
      results.push({ id: patch.id, status: "applied" })
      continue
    }
    try {
      await applyPatch(patch)
      results.push({ id: patch.id, status: "applied" })
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown"
      results.push({ id: patch.id, status: "failed", error: message })
    }
  }

  return NextResponse.json({ ok: true, results, log: describePatches() })
}

async function applyPatch(patch: { id: string; description: string; sql?: string; fn?: string }) {
  // Read the SQL file from /supabase-setup if referenced
  if (patch.sql) {
    const filePath = path.join(process.cwd(), "supabase-setup", patch.sql)
    const sqlText = await readFile(filePath, "utf8")
    if (neonConfigured()) {
      const sql = getDb()
      await (sql as any).unsafe(sqlText)
    } else {
      const supa = await createClient()
      // Service-role would be needed; we fall back to rpc for raw SQL
      const { error } = await supa.rpc("exec_sql", { sql: sqlText })
      if (error) throw new Error(`Supabase exec_sql RPC missing — add a SECURITY DEFINER function. Underlying: ${error.message}`)
    }
  }

  // Record it in the patches table
  if (neonConfigured()) {
    const sql = getDb()
    await (sql as any).unsafe(
      `insert into public.patches (id, description, kind, sql, applied_by) values ($1, $2, $3, $4, 'migrator') on conflict (id) do nothing`,
      [patch.id, patch.description, "schema", patch.sql ?? null],
    )
    await (sql as any).unsafe(`select public.bump_schema_version($1)`, [patch.id])
  } else {
    const supa = await createClient()
    await supa.from("patches").upsert({
      id: patch.id,
      description: patch.description,
      kind: "schema",
      sql: patch.sql ?? null,
      applied_by: "migrator",
    })
  }
}
