import { NextResponse, type NextRequest } from "next/server"
import { isFromSafaricom, parseBillRef, type C2BConfirmationRequest } from "@/lib/mpesa/daraja"
import { neonConfigured, getDb } from "@/lib/db/neon"
import { reconcile, defaultRules, type C2BTransaction, type RuleDef, type TenantCandidate, type MatchContext } from "@/lib/reconcile"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient, isServiceRoleConfigured } from "@/lib/supabase/service"

/**
 * POST /api/mpesa/c2b/confirmation
 *
 * Daraja calls this AFTER the customer has paid. The body has the full
 * receipt. We:
 *   1. Validate origin (Safaricom IP allowlist)
 *   2. Persist the raw transaction to c2b_transactions
 *   3. Run the reconciliation engine to match it to a tenant
 *   4. If matched, create a corresponding rent_payments row
 *   5. Write a reconciliation_audit entry for the decision
 *
 * Public endpoint, no auth (Daraja can't authenticate).
 */
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  if (!isFromSafaricom(request.headers.get("x-forwarded-for"))) {
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Forbidden" }, { status: 403 })
  }

  let body: C2BConfirmationRequest
  try {
    body = (await request.json()) as C2BConfirmationRequest
  } catch {
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Invalid JSON" }, { status: 400 })
  }

  // Daraja expects a 200 with this exact shape.
  const ack = { ResultCode: 0, ResultDesc: "Received" }
  if (!body.TransID) return NextResponse.json(ack, { status: 200 })

  try {
    await processConfirmation(body)
  } catch (err) {
    // Always ack to Daraja — retries would create duplicates. Log for humans.
    console.error("[api/mpesa/c2b/confirmation] processing failed", err)
  }

  return NextResponse.json(ack, { status: 200 })
}

async function processConfirmation(body: C2BConfirmationRequest) {
  const amount = Number(body.TransAmount)
  const billRef = (body.BillRefNumber || "").trim()
  const { tenantId: billTenantId } = parseBillRef(billRef)

  // Build a minimal in-memory txn for the reconciliation engine.
  const txn: C2BTransaction = {
    trans_id: body.TransID,
    trans_time: body.TransTime,
    trans_amount: amount,
    business_short_code: body.BusinessShortCode,
    bill_ref_number: billRef,
    msisdn: body.MSISDN,
    first_name: body.FirstName,
    last_name: body.LastName,
  }

  // Look up the workspace owner via Supabase (the supabase server client
  // resolves the user from cookies if the request came from the dashboard;
  // for Daraja callbacks the user context is the public paybill number —
  // we resolve the owner by matching business_short_code against the
  // `paybills.number` column).
  const owner = await resolveOwnerByShortCode(body.BusinessShortCode)
  if (!owner) {
    console.warn("[c2b] payment destination not found", { shortCode: body.BusinessShortCode })
    return
  }
  txn.paybill_id = owner.paybill_id

  // Fetch candidate tenants + rules.
  const ctx = await buildContext(owner.user_id, owner.paybill_id)
  const result = reconcile(txn, ctx)

  // Persist.
  if (neonConfigured()) {
    await persistNeon({ body, txn, owner, result, billTenantId })
  } else {
    await persistSupabase({ body, txn, owner, result, billTenantId })
  }

  console.info("[c2b] processed", {
    transId: body.TransID,
    amount,
    matched: result.matched_tenant_id,
    method: result.match_method,
    confidence: result.match_confidence,
  })
}

async function resolveOwnerByShortCode(shortCode: string): Promise<{ user_id: string; paybill_id: string } | null> {
  if (neonConfigured()) {
    try {
      const sql = getDb()
      const rows = await sql`select id, user_id from public.paybills where number = ${shortCode} and active = true limit 1`
      if (rows.length > 0) return { user_id: rows[0].user_id as string, paybill_id: rows[0].id as string }
    } catch (err) {
      console.warn("[c2b] neon lookup failed, falling back", err)
    }
  }
  try {
    const supa = await createClient()
    // For Supabase we use the schema query. Service-role would be ideal here.
    const { data } = await supa.from("paybills").select("id, user_id").eq("number", shortCode).eq("active", true).limit(1).maybeSingle()
    if (data) return { user_id: data.user_id, paybill_id: data.id }
  } catch {
    // ignore
  }
  return null
}

async function buildContext(userId: string, paybillId: string): Promise<MatchContext> {
  const tenants: TenantCandidate[] = []
  const rules: RuleDef[] = [...defaultRules]

  if (neonConfigured()) {
    try {
      const sql = getDb()
      const rows = await sql`
        select t.id, t.full_name, t.phone, t.rent_amount as expected_rent,
               t.property_id, p.rent_amount as property_rent, t.lease_end
        from public.tenants t
        left join public.properties p on p.id = t.property_id
        where p.user_id = ${userId}
          and (t.lease_end is null or t.lease_end >= current_date)
      `
      for (const r of rows) {
        tenants.push({
          id: r.id as string,
          full_name: r.full_name as string,
          phone: (r.phone as string) || "",
          expected_rent: r.expected_rent != null ? Number(r.expected_rent) : undefined,
          property_id: r.property_id as string,
          property_rent: r.property_rent != null ? Number(r.property_rent) : undefined,
          is_active: true,
        })
      }
    } catch (err) {
      console.warn("[c2b] failed to load tenants from neon", err)
    }
  }
  return { tenants, rules }
}

async function persistNeon(args: {
  body: C2BConfirmationRequest
  txn: C2BTransaction
  owner: { user_id: string; paybill_id: string }
  result: ReturnType<typeof reconcile>
  billTenantId: string | null
}) {
  const { body, owner, result, billTenantId } = args
  const sql = getDb()

  // 1. Insert c2b_transaction (idempotent on trans_id)
  await sql`
    insert into public.c2b_transactions (
      user_id, paybill_id, transaction_type, trans_id, trans_time, trans_amount,
      business_short_code, bill_ref_number, invoice_number, msisdn, first_name, middle_name, last_name,
      matched_tenant_id, match_method, match_confidence, match_status, raw
    ) values (
      ${owner.user_id}, ${owner.paybill_id}, ${body.TransactionType || null},
      ${body.TransID}, ${body.TransTime}, ${Number(body.TransAmount)},
      ${body.BusinessShortCode}, ${body.BillRefNumber || null}, ${body.InvoiceNumber || null},
      ${body.MSISDN}, ${body.FirstName || null}, ${body.MiddleName || null}, ${body.LastName || null},
      ${result.matched_tenant_id}, ${result.match_method}, ${result.match_confidence},
      ${result.matched_tenant_id ? "matched" : "unmatched"}, ${JSON.stringify(body)}
    )
    on conflict (trans_id) do update set
      match_status = excluded.match_status,
      matched_tenant_id = excluded.matched_tenant_id,
      match_method = excluded.match_method,
      match_confidence = excluded.match_confidence
  `

  // 2. If matched, also create a rent_payments row
  if (result.matched_tenant_id) {
    await sql`
      insert into public.rent_payments (
        user_id, tenant_id, amount, paid_date, status, payment_method, notes
      ) values (
        ${owner.user_id}, ${result.matched_tenant_id}, ${Number(body.TransAmount)},
        current_date, 'paid', 'mpesa_c2b',
        ${"Auto-reconciled via " + result.match_method + " (TransID " + body.TransID + ")"}
      )
    `
  }

  // 3. Audit
  await sql`
    insert into public.reconciliation_audit (
      user_id, c2b_transaction_id, decision, matched_tenant_id, confidence, notes
    ) values (
      ${owner.user_id}, ${body.TransID}, ${result.matched_tenant_id ? "matched" : "unmatched"},
      ${result.matched_tenant_id}, ${result.match_confidence}, ${result.notes}
    )
  `

  // 4. Update paybill counters (fire-and-forget)
  await sql`
    update public.paybills
    set matched_count = matched_count + ${result.matched_tenant_id ? 1 : 0},
        unmatched_count = unmatched_count + ${result.matched_tenant_id ? 0 : 1},
        last_payment_at = now()
    where id = ${owner.paybill_id}
  `

  // Defeat unused-var warning
  void billTenantId
}

async function persistSupabase(args: {
  body: C2BConfirmationRequest
  txn: C2BTransaction
  owner: { user_id: string; paybill_id: string }
  result: ReturnType<typeof reconcile>
  billTenantId: string | null
}) {
  // Public callbacks can't use a user-scoped client. We require the service
  // role key for this fallback. If it's not configured, log a warning and
  // skip the writes — the operator should configure service role on Supabase
  // deploys that depend on C2B.
  const supa = createServiceClient() ?? (await createClient())
  const isAdmin = isServiceRoleConfigured()
  if (!isAdmin) {
    console.warn("[c2b] SUPABASE_SERVICE_ROLE_KEY not set — callback writes may be blocked by RLS. Set the env var to enable.")
  }
  const { error: txnErr } = await supa.from("c2b_transactions").upsert({
    paybill_id: args.owner.paybill_id,
    transaction_type: args.body.TransactionType,
    trans_id: args.body.TransID,
    trans_time: args.body.TransTime,
    trans_amount: Number(args.body.TransAmount),
    business_short_code: args.body.BusinessShortCode,
    bill_ref_number: args.body.BillRefNumber,
    msisdn: args.body.MSISDN,
    first_name: args.body.FirstName,
    last_name: args.body.LastName,
    match_status: args.result.matched_tenant_id ? "matched" : "unmatched",
    match_method: args.result.match_method,
    match_confidence: args.result.match_confidence,
    matched_tenant_id: args.result.matched_tenant_id,
    raw: args.body,
  }, { onConflict: "trans_id" })
  if (txnErr) {
    console.warn("[c2b] supabase c2b_transactions insert failed", txnErr.message)
    return
  }
  // 2. If matched, also create a rent_payments row
  if (args.result.matched_tenant_id) {
    const { error: payErr } = await supa.from("rent_payments").insert({
      user_id: args.owner.user_id,
      tenant_id: args.result.matched_tenant_id,
      amount: Number(args.body.TransAmount),
      paid_date: new Date().toISOString().slice(0, 10),
      status: "paid",
      payment_method: "mpesa_c2b",
      notes: "Auto-reconciled via " + args.result.match_method + " (TransID " + args.body.TransID + ")",
    })
    if (payErr) console.warn("[c2b] rent_payments insert failed", payErr.message)
  }
  // 3. Audit
  const { error: auditErr } = await supa.from("reconciliation_audit").insert({
    user_id: args.owner.user_id,
    c2b_transaction_id: args.body.TransID,
    decision: args.result.matched_tenant_id ? "matched" : "unmatched",
    matched_tenant_id: args.result.matched_tenant_id,
    confidence: args.result.match_confidence,
    notes: args.result.notes,
  })
  if (auditErr) console.warn("[c2b] reconciliation_audit insert failed", auditErr.message)
  // 4. Bump paybill counters via RPC (function we ship in 10-holy-grail.sql)
  try {
    const { error: rpcErr } = await supa.rpc("bump_paybill_counters", {
      p_paybill_id: args.owner.paybill_id,
      p_matched: !!args.result.matched_tenant_id,
    })
    if (rpcErr) console.warn("[c2b] bump_paybill_counters failed", rpcErr.message)
  } catch {/* RPC not installed in this env — fine */}
  void args.billTenantId
}
