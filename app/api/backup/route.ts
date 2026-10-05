import { NextResponse, type NextRequest } from "next/server"
import { withAuth } from "@/lib/api"
import { exportBackup, recordBackup, listBackups } from "@/lib/backup"
import { backupFilename, formatSize, BACKUP_TABLES } from "@/lib/system"
import { uploadBackup, BACKUP_SIZE_LIMIT } from "@/lib/storage"

/**
 * /api/backup
 * GET  — list backups (lightweight list, no payloads)
 * POST — create a full backup (returns payload, records metadata)
 *
 * Both require auth. Users only see / create their own backups.
 *
 * For backups > 5 MB, the JSON is pushed to Supabase Storage
 * ("backups" bucket) and only the path is recorded in the DB. The
 * download endpoint signs a short-lived URL on demand.
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

  const label = body?.label ?? `Manual backup ${new Date().toISOString().slice(0, 16).replace("T", " ")}`
  let storageKind: "inline" | "storage" = "inline"
  let storagePath: string | null = null
  let inlinePayload: typeof payload | null = payload
  let storageError: string | undefined

  if (sizeBytes > BACKUP_SIZE_LIMIT) {
    const filename = backupFilename().replace(/\.json$/, "")
    const up = await uploadBackup(userId, filename, json)
    if (up.ok) {
      storageKind = "storage"
      storagePath = up.path
      inlinePayload = null
    } else {
      storageError = up.error
      // Fall back to inline storage so the user doesn't lose their backup
      storageKind = "inline"
    }
  }

  const id = await recordBackup(userId, {
    label,
    kind: "full",
    format: "json",
    size_bytes: sizeBytes,
    row_count: rowCount,
    storage_kind: storageKind,
    storage_path: storagePath,
    payload: inlinePayload,
    metadata: {
      app_version: payload.app_version,
      schema_version: payload.schema_version,
      counts: payload.counts,
      storage_error: storageError,
    },
    source: body?.source ?? "manual",
  })

  return NextResponse.json({
    ok: true,
    id,
    filename: backupFilename(),
    size_bytes: sizeBytes,
    size_human: formatSize(sizeBytes),
    row_count: rowCount,
    counts: payload.counts,
    storage_kind: storageKind,
    storage_path: storagePath,
    payload: inlinePayload,
  })
})

void BACKUP_TABLES