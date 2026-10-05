import { NextResponse, type NextRequest } from "next/server"
import { withAuth } from "@/lib/api"
import { c2bTransactionStatus } from "@/lib/mpesa/daraja"
import { neonConfigured, getDb } from "@/lib/db/neon"

/**
 * GET /api/mpesa/c2b/status/[transId]
 * Re-query Daraja for the current status of a C2B transaction.
 * Useful after a flaky confirmation callback.
 */
export const runtime = "nodejs"

export const GET = withAuth(async (_request, { userId }, { transId }) => {
  // First, return the cached view from our DB
  if (neonConfigured()) {
    try {
      const sql = getDb()
      const rows = await sql`
        select id, trans_id, trans_amount, match_status, matched_tenant_id, match_method, created_at
        from public.c2b_transactions
        where trans_id = ${transId} and user_id = ${userId}
        limit 1
      `
      if (rows.length > 0) {
        return NextResponse.json({
          cached: true,
          transaction: rows[0],
        })
      }
    } catch (err) {
      console.warn("[c2b status] cache lookup failed", err)
    }
  }

  // Otherwise, ask Daraja
  try {
    const status = await c2bTransactionStatus(transId)
    return NextResponse.json({ cached: false, daraja: status })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Status query failed"
    return NextResponse.json({ error: message }, { status: 502 })
  }
})