import { NextResponse, type NextRequest } from "next/server"
import { withAuth } from "@/lib/api"
import { restoreBackup } from "@/lib/backup"
import { BackupPayloadSchema, RestoreOptionsSchema } from "@/lib/system"

/**
 * POST /api/backup/import
 * Restore from a previously exported backup.
 *
 * Body: {
 *   payload: { ...BackupPayload },
 *   options?: {
 *     tables?: string[],
 *     on_conflict?: 'skip' | 'replace' | 'merge',
 *     dry_run?: boolean,
 *   }
 * }
 */
export const runtime = "nodejs"

export const POST = withAuth(async (request, { userId }) => {
  const body = (await request.json().catch(() => null)) as {
    payload?: unknown
    options?: unknown
  } | null
  if (!body?.payload) {
    return NextResponse.json({ error: "Missing payload" }, { status: 400 })
  }

  // Validate payload shape
  const parse = BackupPayloadSchema.safeParse(body.payload)
  if (!parse.success) {
    return NextResponse.json(
      {
        error: "Invalid backup file",
        issues: parse.error.issues.slice(0, 5).map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    )
  }

  // Validate options
  const optionsParsed = body.options
    ? RestoreOptionsSchema.safeParse(body.options)
    : { success: true, data: RestoreOptionsSchema.parse({}) }
  if (!optionsParsed.success) {
    return NextResponse.json({ error: "Invalid restore options" }, { status: 400 })
  }

  const result = await restoreBackup(userId, parse.data, optionsParsed.data)
  return NextResponse.json({ ok: true, result })
})