import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api"
import { listBackups } from "@/lib/backup"

export const runtime = "nodejs"

export const GET = withAuth(async (_request, { userId }) => {
  const backups = await listBackups(userId)
  return NextResponse.json({ count: backups.length, backups })
})