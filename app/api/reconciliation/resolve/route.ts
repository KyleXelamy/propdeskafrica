import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api"
import { getDb, neonConfigured } from "@/lib/db/neon"

const schema = z.object({ trans_id: z.string().trim().min(1).max(80), decision: z.enum(["matched", "rejected"]), tenant_id: z.string().uuid().optional(), note: z.string().trim().max(500).optional() })

export const runtime = "nodejs"

export const POST = withAuth(async (request, { userId }) => {
  if (!neonConfigured()) return NextResponse.json({ error: "Reconciliation is temporarily unavailable." }, { status: 503 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid reconciliation decision." }, { status: 400 })
  const sql = getDb()
  const rows = await sql`select id, matched_tenant_id from public.c2b_transactions where trans_id = ${parsed.data.trans_id} and user_id = ${userId} limit 1`
  if (!rows[0]) return NextResponse.json({ error: "Transaction not found." }, { status: 404 })
  const tenantId = parsed.data.tenant_id ?? rows[0].matched_tenant_id ?? null
  if (parsed.data.decision === "matched" && !tenantId) return NextResponse.json({ error: "Select a tenant before confirming this payment." }, { status: 400 })
  if (tenantId) {
    const tenant = await sql`select t.id from public.tenants t join public.properties p on p.id = t.property_id where t.id = ${tenantId} and p.user_id = ${userId} limit 1`
    if (!tenant[0]) return NextResponse.json({ error: "Tenant not found." }, { status: 404 })
  }
  const status = parsed.data.decision === "matched" ? "matched" : "unmatched"
  await sql`update public.c2b_transactions set matched_tenant_id = ${parsed.data.decision === "matched" ? tenantId : null}, match_method = ${parsed.data.decision === "matched" ? "manual" : "unmatched"}, match_confidence = ${parsed.data.decision === "matched" ? 1 : 0}, match_status = ${status} where id = ${rows[0].id} and user_id = ${userId}`
  await sql`insert into public.reconciliation_audit (user_id, c2b_transaction_id, decision, matched_tenant_id, confidence, notes) values (${userId}, ${rows[0].id}, ${parsed.data.decision}, ${parsed.data.decision === "matched" ? tenantId : null}, ${parsed.data.decision === "matched" ? 1 : 0}, ${parsed.data.note ?? `Manual ${parsed.data.decision} decision`})`
  return NextResponse.json({ ok: true })
})
