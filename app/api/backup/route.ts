import { NextResponse, type NextRequest } from "next/server"
import { withAuth } from "@/lib/api"
import { exportBackup, recordBackup, listBackups } from "@/lib/backup"
import { backupFilename, formatSize, BACKUP_TABLES } from "@/lib/system"

/**
 * /api/backup
 * GET  — list backups (lightweight list, no payloads)
 * POST — create a full backup (returns payload, records metadata)
 *
 * Both require auth. Users only see / create their own backups.
 */
export const runtime = "nodejs"

export const GET = withAuth(async (_request, { userId }) => {
  const list = await listBackups(userId)
  return NextResponse.json({ count: list.length, backups: list })
})

export const POST = withAuth(async (request, { userId, supabase }) => {
  const body = (await request.json().catch(() => null)) as {
    label?: string
    tables?: string[]
    source?: "manual" | "scheduled" | "pre-patch" | "pre-migration"
  } | null

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  const email = authUser?.email

  const payload = await exportBackup(userId, email, {
    tables: body?.tables,
  })
  const rowCount = Object.values(payload.counts).reduce((a, b) => a + b, 0)
  const json = JSON.stringify(payload, null, 2)
  const sizeBytes = new TextEncoder().encode(json).length

  // Persist a record of this backup. Inline for JSON under 5MB; otherwise
  // the dashboard is told to use Supabase Storage (out of scope here).
  const label = body?.label ?? `Manual backup ${new Date().toISOString().slice(0, 16).replace("T", " ")}`
  const id = await recordBackup(userId, {
    label,
    kind: "full",
    format: "json",
    size_bytes: sizeBytes,
    row_count: rowCount,
    storage_kind: sizeBytes > 5 * 1024 * 1024 ? "storage" : "inline",
    storage_path: null,
    payload: sizeBytes > 5 * 1024 * 1024 ? null : payload,
    metadata: {
      app_version: payload.app_version,
      schema_version: payload.schema_version,
      counts: payload.counts,
    },
    source: body?.source ?? "manual",
  })

  // Return both the metadata and the payload so the dashboard can
  // immediately download without a second round-trip.
  return NextResponse.json({
    ok: true,
    id,
    filename: backupFilename(),
    size_bytes: sizeBytes,
    size_human: formatSize(sizeBytes),
    row_count: rowCount,
    counts: payload.counts,
    payload,
  })
})

void BACKUP_TABLES