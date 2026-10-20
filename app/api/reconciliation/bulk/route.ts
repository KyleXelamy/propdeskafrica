import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api"
import { getDb, neonConfigured } from "@/lib/db/neon"

const schema = z.object({
  transaction_ids: z.array(z.string().trim().min(1).max(80)).min(1).max(100),
  decision: z.enum(["rejected"]),
  note: z.string().trim().max(500).optional(),
})

export const runtime = "nodejs"

export const POST = withAuth(async (request, { userId }) => {
  if (!neonConfigured()) return NextResponse.json({ error: "Reconciliation is temporarily unavailable." }, { status: 503 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid bulk decision." }, { status: 400 })
  const sql = getDb()
  const transactions = await sql`
    select id, trans_id, matched_tenant_id, match_status
    from public.c2b_transactions
    where user_id = ${userId} and trans_id = any(${parsed.data.transaction_ids}::text[])
    for update
  `
  if (!transactions.length) return NextResponse.json({ error: "No matching transactions found." }, { status: 404 })
  await sql.transaction(transactions.flatMap((transaction) => [
    sql`update public.c2b_transactions set matched_tenant_id = null, match_method = 'unmatched', match_confidence = 0, match_status = 'unmatched' where id = ${transaction.id} and user_id = ${userId}`,
    sql`insert into public.reconciliation_audit (user_id, c2b_transaction_id, decision, matched_tenant_id, confidence, notes) values (${userId}, ${transaction.id}, 'rejected', null, 0, ${parsed.data.note ?? "Bulk rejected during reconciliation review"})`,
  ]))
  return NextResponse.json({ ok: true, processed: transactions.length })
})
