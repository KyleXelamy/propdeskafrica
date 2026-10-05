import { NextResponse, type NextRequest } from "next/server"
import { withAuth } from "@/lib/api"
import { getBackup, deleteBackup } from "@/lib/backup"
import { getBackupSignedUrl } from "@/lib/storage"

export const runtime = "nodejs"

export const GET = withAuth(async (_request, { userId }, { id }) => {
  const backup = await getBackup(userId, id)
  if (!backup) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (backup.storage_kind === "storage" && backup.storage_path) {
    const signedUrl = await getBackupSignedUrl(userId, backup.storage_path)
    if (signedUrl) {
      return NextResponse.json({ backup, signed_url: signedUrl, expires_in: 600 })
    }
    return NextResponse.json(
      { error: "Backup is in object storage but the signed URL couldn't be generated. Set SUPABASE_SERVICE_ROLE_KEY.", backup },
      { status: 500 },
    )
  }
  return NextResponse.json({ backup })
})

export const DELETE = withAuth(async (_request, { userId }, { id }) => {
  const ok = await deleteBackup(userId, id)
  return NextResponse.json({ ok })
})