import { errorResponse, successResponse, HttpError } from "@/lib/api"
import { getDb, neonConfigured } from "@/lib/db/neon"
import { runMigrations } from "@/lib/db/migrate"

/**
 * POST /api/cron/run
 * Body (optional): { only?: "lease" | "recurring" | "document" | "maintenance" }
 *
 * Public-style endpoint. In production, gate it with `CRON_SECRET`:
 *   - Send `Authorization: Bearer ${CRON_SECRET}` to allow the call.
 *   - Vercel Cron, GitHub Actions, etc. can set this header.
 *
 * Runs all the scan functions (lease expiry, recurring expenses, document
 * expiry, maintenance reminders) in one round trip. Use this instead of
 * the missing pg_cron — schedule it externally.
 *
 * Optional `?migrate=1` runs pending DB migrations before scanning. Useful
 * for first-deploy boot: just hit the endpoint once after deploy and the
 * schema is set up + scans fire.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET
  if (process.env.NODE_ENV === "production" && !secret) {
    return errorResponse("CRON_SECRET must be configured in production", 503)
  }
  if (secret) {
    const auth = req.headers.get("authorization") || ""
    const got = auth.replace(/^Bearer\s+/i, "").trim()
    if (got !== secret) {
      return errorResponse("Forbidden: missing or invalid CRON_SECRET", 403)
    }
  }
  if (!neonConfigured()) {
    return errorResponse("DATABASE_URL not configured", 500)
  }
  const sql = getDb()
  const body = await req.json().catch(() => ({})) as { only?: string }

  // Optional: run pending migrations first
  if (new URL(req.url).searchParams.get("migrate") === "1") {
    try {
      await runMigrations({ silent: true })
    } catch (e: any) {
      return errorResponse(`Migration failed: ${e?.message || e}`, 500)
    }
  }

  if (body.only) {
    // Run a single scan
    let result: any
    switch (body.only) {
      case "lease":       result = await sql`SELECT public.run_lease_expiry_scan() AS inserted`; break
      case "recurring":   result = await sql`SELECT public.run_recurring_expenses() AS inserted`; break
      case "document":    result = await sql`SELECT public.run_document_expiry_scan() AS inserted`; break
      case "maintenance": result = await sql`SELECT public.run_maintenance_reminder_scan() AS inserted`; break
      default: throw new HttpError(`Unknown scan: ${body.only}`, 400)
    }
    return successResponse({ [body.only]: Number(result?.[0]?.inserted) || 0 })
  }

  // Run all four scans in one round trip
  const rows = await sql`SELECT * FROM public.run_all_scans()` as { scan: string; inserted: number }[]
  const summary: Record<string, number> = {}
  for (const r of rows) summary[r.scan] = Number(r.inserted) || 0
  return successResponse({ ...summary, ran_at: new Date().toISOString() })
}
