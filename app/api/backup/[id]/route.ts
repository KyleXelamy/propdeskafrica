import { NextResponse, type NextRequest } from "next/server"
import { withAuth } from "@/lib/api"
import { getBackup, deleteBackup } from "@/lib/backup"

export const runtime = "nodejs"

export const GET = withAuth(async (_request, { userId }, { id }) => {
  const backup = await getBackup(userId, id)
  if (!backup) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ backup })
})

export const DELETE = withAuth(async (_request, { userId }, { id }) => {
  const ok = await deleteBackup(userId, id)
  return NextResponse.json({ ok })
})