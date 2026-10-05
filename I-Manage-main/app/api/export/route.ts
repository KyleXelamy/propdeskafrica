import { withAuth, errorResponse } from "@/lib/api"
import type { NextRequest } from "next/server"

/**
 * GET /api/export?format=json|csv
 *
 * Streams a file download of the user's data. Used by the Settings page.
 *   - format=json → application/json (default)
 *   - format=csv  → text/csv with one file per table, zipped (simple)
 *
 * NOTE: For a real production build we'd add proper ZIP packaging and
 * stream a single multipart archive. For now we deliver a CSV bundle as
 * a JSON envelope (one key per table) — keeping the code small but
 * correct enough to actually hand the user a downloadable artifact.
 */
export const GET = withAuth(async (req: NextRequest, { supabase, userId }) => {
  const { searchParams } = new URL(req.url)
  const format = (searchParams.get("format") || "json").toLowerCase()

  const [properties, tenants, payments, expenses, maintenance, notes, documents] = await Promise.all([
    supabase.from("properties").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("tenants").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("rent_payments").select("*").eq("user_id", userId).order("payment_date"),
    supabase.from("expenses").select("*").eq("user_id", userId).order("expense_date"),
    supabase.from("maintenance_requests").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("notes").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("documents").select("id, name, type, file_url, file_size, mime_type, created_at")
      .eq("user_id", userId).order("created_at"),
  ])

  const anyError =
    properties.error || tenants.error || payments.error || expenses.error ||
    maintenance.error || notes.error || documents.error
  if (anyError) {
    return errorResponse(anyError.message || "Failed to load export data", 500)
  }

  const stamp = new Date().toISOString().slice(0, 10)
  const filename = `i-manage-export-${stamp}.${format === "csv" ? "csv" : "json"}`

  if (format === "csv") {
    // Generate a single CSV containing all tables, separated by a header row.
    const sections: string[] = []
    const addSection = (title: string, rows: any[] | null | undefined) => {
      if (!rows || rows.length === 0) {
        sections.push(`# ${title}\n(no rows)`)
        return
      }
      const cols = Object.keys(rows[0])
      const header = cols.join(",")
      const body = rows
        .map((r) =>
          cols
            .map((c) => {
              const v = r[c]
              if (v == null) return ""
              const s = typeof v === "object" ? JSON.stringify(v) : String(v)
              // Escape commas / quotes / newlines per RFC 4180
              return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
            })
            .join(","),
        )
        .join("\n")
      sections.push(`# ${title}\n${header}\n${body}`)
    }

    addSection("properties", properties.data)
    addSection("tenants", tenants.data)
    addSection("rent_payments", payments.data)
    addSection("expenses", expenses.data)
    addSection("maintenance_requests", maintenance.data)
    addSection("notes", notes.data)
    addSection("documents", documents.data)

    const csv = sections.join("\n\n")
    return new Response(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      },
    })
  }

  // JSON envelope
  const payload = {
    user: { id: userId },
    generatedAt: new Date().toISOString(),
    counts: {
      properties: properties.data?.length || 0,
      tenants: tenants.data?.length || 0,
      payments: payments.data?.length || 0,
      expenses: expenses.data?.length || 0,
      maintenance: maintenance.data?.length || 0,
      notes: notes.data?.length || 0,
      documents: documents.data?.length || 0,
    },
    data: {
      properties: properties.data || [],
      tenants: tenants.data || [],
      rent_payments: payments.data || [],
      expenses: expenses.data || [],
      maintenance_requests: maintenance.data || [],
      notes: notes.data || [],
      documents: documents.data || [],
    },
  }
  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  })
})
