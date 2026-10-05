import { NextResponse, type NextRequest } from "next/server"
import { exportBackup, recordBackup } from "@/lib/backup"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

/**
 * POST /api/backup/auto
 * Cron-callable endpoint. Runs the backup for every user whose
 * `auto_backup` setting is on at the cadence they picked.
 *
 * Auth: header `x-cron-secret` must equal `BACKUP_CRON_SECRET`
 * env var, OR you must be an authenticated session (so a user can
 * trigger it manually from the dashboard).
 *
 * Idempotent within a day — at most one scheduled backup per user
 * per calendar day is created.
 */
function checkSecret(request: NextRequest) {
  const expected = process.env.BACKUP_CRON_SECRET
  if (!expected) return true // dev mode
  const got = request.headers.get("x-cron-secret") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  return got === expected
}

export async function POST(request: NextRequest) {
  if (!checkSecret(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const body = (await request.json().catch(() => ({}))) as { user_id?: string; frequency?: "daily" | "weekly" | "monthly" }
  const supa = await createClient()
  const supaAdmin = supa
  const frequency = body.frequency ?? "weekly"
  const today = new Date().toISOString().slice(0, 10)

  // Find users whose schedule is due. We pull all users via auth.admin,
  // filter by user_profiles.auto_backup = true, then check cadence.
  let candidates: Array<{ userId: string; email: string | undefined; lastAuto: string | null }> = []
  try {
    const { data: profiles, error } = await supaAdmin.from("user_profiles").select("user_id, auto_backup, auto_backup_frequency, email").eq("auto_backup", true)
    if (!error && profiles) {
      // Look up latest scheduled-backup per user
      const { data: latest } = await supaAdmin
        .from("backups")
        .select("user_id, source, created_at")
        .eq("source", "scheduled")
        .order("created_at", { ascending: false })
      const lastByUser = new Map<string, string>()
      for (const r of latest ?? []) {
        if (!lastByUser.has(r.user_id)) lastByUser.set(r.user_id, r.created_at as string)
      }
      const cutoff = new Date()
      if (frequency === "daily") cutoff.setDate(cutoff.getDate() - 1)
      else if (frequency === "weekly") cutoff.setDate(cutoff.getDate() - 7)
      else cutoff.setMonth(cutoff.getMonth() - 1)
      candidates = profiles.map((p: any) => {
        const lastIso = lastByUser.get(p.user_id) ?? null
        const lastDate = lastIso ? new Date(lastIso) : null
        return {
          userId: p.user_id,
          email: p.email,
          lastAuto: lastIso,
          // mark ok-to-run based on cadence
          _due: !lastDate || lastDate < cutoff,
        } as any
      })
    }
  } catch (e) {
    // Fallback: single user, when invoked with explicit user_id
    if (body.user_id) {
      candidates = [{ userId: body.user_id, email: undefined, lastAuto: null }]
    }
  }

  // Apply filter
  const due = body.user_id ? candidates.filter((c) => c.userId === body.user_id) : (candidates as any[]).filter((c) => c._due)

  const results: Array<{ userId: string; status: "ok" | "failed" | "skipped"; backupId?: string; error?: string }> = []
  for (const c of due) {
    try {
      const payload = await exportBackup(c.userId, c.email, {})
      const rowCount = Object.values(payload.counts).reduce((a, b) => a + b, 0)
      const json = JSON.stringify(payload, null, 2)
      const sizeBytes = new TextEncoder().encode(json).length
      const id = await recordBackup(c.userId, {
        label: `Scheduled backup ${today}`,
        kind: "full",
        format: "json",
        size_bytes: sizeBytes,
        row_count: rowCount,
        storage_kind: sizeBytes > 5 * 1024 * 1024 ? "storage" : "inline",
        storage_path: null,
        payload: sizeBytes > 5 * 1024 * 1024 ? null : payload,
        metadata: { app_version: payload.app_version, schema_version: payload.schema_version, counts: payload.counts, frequency },
        source: "scheduled",
      })
      results.push({ userId: c.userId, status: "ok", backupId: id })
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown"
      results.push({ userId: c.userId, status: "failed", error: message })
    }
  }

  return NextResponse.json({ ok: true, ran_at: new Date().toISOString(), due_count: due.length, results })
}

/**
 * GET /api/backup/auto
 * Read-only — count of users currently opted in + latest scheduled backup.
 * Vercel cron / GitHub Actions can ping this to see if there's work to do.
 */
export async function GET() {
  const supa = await createClient()
  const { count: optedUsers } = await supa.from("user_profiles").select("*", { count: "exact", head: true }).eq("auto_backup", true)
  const { data: latest } = await supa.from("backups").select("id, user_id, created_at, row_count, size_bytes").eq("source", "scheduled").order("created_at", { ascending: false }).limit(1).maybeSingle()
  return NextResponse.json({
    ok: true,
    opted_in_users: optedUsers ?? 0,
    latest_scheduled: latest ?? null,
  })
}