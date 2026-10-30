import { NextResponse, type NextRequest } from "next/server"
import { withAuth } from "@/lib/api"
import { c2bTransactionStatus } from "@/lib/mpesa/daraja"
import { neonConfigured, getDb } from "@/lib/db/neon"

/**
 * GET /api/mpesa/c2b/status/[transId]
 * Re-query Daraja for the current status of a C2B transaction.
 * Useful after a flaky confirmation callback.
 *
 * SECURITY: the Daraja fallback returned the payer's MSISDN and full name for
 * ANY transId, to any signed-in user — another workspace's payer identity.
 * The upstream query now only runs for a transaction that is already known to
 * belong to the caller. An unknown transaction is a 404, not an existence
 * oracle.
 */
export const runtime = "nodejs"

export const GET = withAuth(async (_request, { userId }, { transId }) => {
  // First, return the cached view from our DB — scoped to the caller.
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

  // The transaction is not ours. Do not ask Safaricom about it — that would
  // disclose the payer's identity to a caller who has no claim to it.
  return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
})

void c2bTransactionStatus
