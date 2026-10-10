import { NextResponse, type NextRequest } from "next/server"
import { withAuth } from "@/lib/api"
import { exportBackup } from "@/lib/backup"
import { BACKUP_TABLES, toCSV, formatSize } from "@/lib/system"

export const runtime = "nodejs"

/**
 * GET /api/backup/csv/[table]
 * Export one table as CSV. The CSV is downloaded as `propdeskafrica-{table}-{date}.csv`.
 */
export const GET = withAuth(async (_request, { userId, supabase }, { table }) => {
  if (!table || !(BACKUP_TABLES as readonly string[]).includes(table)) {
    return NextResponse.json({ error: "Unknown table", allowed: BACKUP_TABLES }, { status: 400 })
  }
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const payload = await exportBackup(userId, user?.email, { tables: [table] })
  const rows = payload.data[table] ?? []
  const csv = toCSV(rows)
  const today = new Date().toISOString().slice(0, 10)
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="propdeskafrica-${table}-${today}.csv"`,
      "X-Row-Count": String(rows.length),
      "X-Size-Bytes": String(new TextEncoder().encode(csv).length),
      "X-Size-Human": formatSize(new TextEncoder().encode(csv).length),
    },
  })
})