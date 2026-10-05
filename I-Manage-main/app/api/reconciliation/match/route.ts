import { NextResponse, type NextRequest } from "next/server"
import { withAuth } from "@/lib/api"
import { reconcile, defaultRules, type C2BTransaction, type RuleDef, type MatchContext } from "@/lib/reconcile"
import { neonConfigured, getDb } from "@/lib/db/neon"

/**
 * POST /api/reconciliation/match
 * Manually re-run the reconciliation engine on a specific C2B transaction
 * (e.g. after rules are updated, or to re-evaluate an unmatched payment).
 *
 * Body: { trans_id, dry_run? }
 */
export const runtime = "nodejs"

export const POST = withAuth(async (request, { userId }) => {
  const body = (await request.json().catch(() => null)) as { trans_id?: string; dry_run?: boolean } | null
  if (!body?.trans_id) {
    return NextResponse.json({ error: "trans_id required" }, { status: 400 })
  }

  if (!neonConfigured()) {
    return NextResponse.json({ error: "Reconciliation requires Neon DATABASE_URL" }, { status: 501 })
  }

  const sql = getDb()

  // 1. Load the C2B transaction
  const txnRows = await sql`
    select id, paybill_id, trans_id, trans_time, trans_amount, bill_ref_number, msisdn
    from public.c2b_transactions
    where trans_id = ${body.trans_id} and user_id = ${userId}
    limit 1
  `
  if (txnRows.length === 0) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
  }
  const row = txnRows[0]

  // 2. Build the context
  const tenantRows = await sql`
    select t.id, t.full_name, t.phone, t.rent_amount as expected_rent,
           t.property_id, p.rent_amount as property_rent
    from public.tenants t
    left join public.properties p on p.id = t.property_id
    where p.user_id = ${userId}
      and (t.lease_end is null or t.lease_end >= current_date)
  `
  const ruleRows = await sql`
    select id, match_by, priority, config
    from public.reconciliation_rules
    where user_id = ${userId} and active = true
    order by priority desc
  `
  const ctx: MatchContext = {
    tenants: tenantRows.map((r: any) => ({
      id: r.id,
      full_name: r.full_name,
      phone: r.phone,
      expected_rent: r.expected_rent != null ? Number(r.expected_rent) : undefined,
      property_id: r.property_id,
      property_rent: r.property_rent != null ? Number(r.property_rent) : undefined,
      is_active: true,
    })),
    rules: ruleRows.length > 0
      ? ruleRows.map((r: any) => ({
          id: r.id,
          match_by: r.match_by,
          priority: r.priority,
          config: r.config ?? {},
        }))
      : defaultRules,
  }

  const txn: C2BTransaction = {
    trans_id: row.trans_id,
    trans_time: row.trans_time,
    trans_amount: Number(row.trans_amount),
    business_short_code: "",
    bill_ref_number: row.bill_ref_number || "",
    msisdn: row.msisdn || "",
    paybill_id: row.paybill_id,
  }

  const result = reconcile(txn, ctx)

  if (!body.dry_run) {
    await sql`
      update public.c2b_transactions
      set matched_tenant_id = ${result.matched_tenant_id},
          match_method = ${result.match_method},
          match_confidence = ${result.match_confidence},
          match_status = ${result.matched_tenant_id ? "matched" : "unmatched"}
      where trans_id = ${body.trans_id} and user_id = ${userId}
    `
    await sql`
      insert into public.reconciliation_audit (
        user_id, c2b_transaction_id, decision, matched_tenant_id, confidence, notes
      ) values (
        ${userId}, ${row.id}, ${result.matched_tenant_id ? "matched" : "unmatched"},
        ${result.matched_tenant_id}, ${result.match_confidence}, ${"Re-run: " + result.notes}
      )
    `
  }

  return NextResponse.json({
    ok: true,
    dry_run: Boolean(body.dry_run),
    transaction_id: row.id,
    result,
  })
})