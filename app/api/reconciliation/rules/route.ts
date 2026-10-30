import { NextResponse, type NextRequest } from "next/server"
import { withAuth, dbError } from "@/lib/api"
import { z } from "zod"
import { neonConfigured, getDb } from "@/lib/db/neon"
import { createClient } from "@/lib/supabase/server"

/**
 * /api/reconciliation/rules
 * GET  — list rules
 * POST — create a new rule
 */

const MatchBy = z.enum([
  "phone",
  "account_ref",
  "amount_property",
  "amount_tenant",
  "closest_amount",
])

const Schema = z.object({
  paybill_id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80),
  match_by: MatchBy,
  priority: z.number().int().min(0).max(1000).default(0),
  active: z.boolean().default(true),
  config: z
    .object({
      amount_tolerance_pct: z.number().min(0).max(100).optional(),
      amount_tolerance_abs: z.number().int().min(0).optional(),
      only_active_tenants: z.boolean().optional(),
    })
    .optional(),
})

export const runtime = "nodejs"

const defaultRulesSeed = [
  { name: "Account reference (UUID or short code)", match_by: "account_ref", priority: 100 },
  { name: "Phone number match", match_by: "phone", priority: 80, config: { only_active_tenants: true } },
  { name: "Amount vs tenant expected rent", match_by: "amount_tenant", priority: 60, config: { amount_tolerance_pct: 2, amount_tolerance_abs: 50 } },
  { name: "Amount vs property rent (single tenant)", match_by: "amount_property", priority: 40, config: { amount_tolerance_pct: 2, amount_tolerance_abs: 50, only_active_tenants: true } },
  { name: "Closest amount heuristic", match_by: "closest_amount", priority: 20 },
]

export const GET = withAuth(async (_request, { userId }) => {
  if (neonConfigured()) {
    try {
      const sql = getDb()
      const rows = await sql`
        select id, paybill_id, name, match_by, priority, active, config, created_at
        from public.reconciliation_rules
        where user_id = ${userId}
        order by priority desc, created_at asc
      `
      if (rows.length > 0) {
        return NextResponse.json({ count: rows.length, rules: rows })
      }
    } catch (err) {
      console.warn("[reconciliation/rules] neon read failed", err)
    }
  }
  // Fall back: Supabase + a default seed
  const supa = await createClient()
  const { data, error } = await supa
    .from("reconciliation_rules")
    .select("id, paybill_id, name, match_by, priority, active, config, created_at")
    .eq("user_id", userId)
    .order("priority", { ascending: false })
  if (error) {
    return dbError("reconciliation/rules", error, 500)
  }
  if (data && data.length > 0) {
    return NextResponse.json({ count: data.length, rules: data })
  }
  return NextResponse.json({
    count: defaultRulesSeed.length,
    rules: defaultRulesSeed.map((r, i) => ({
      id: `seed-${i}`,
      user_id: userId,
      created_at: new Date().toISOString(),
      active: true,
      ...r,
    })),
    note: "Default ruleset — no rules configured yet.",
  })
})

export const POST = withAuth(async (request, { userId }) => {
  const json = await request.json().catch(() => null)
  const parsed = Schema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    )
  }
  if (neonConfigured()) {
    try {
      const sql = getDb()
      const rows = await sql`
        insert into public.reconciliation_rules (
          user_id, paybill_id, name, match_by, priority, active, config
        ) values (
          ${userId}, ${parsed.data.paybill_id ?? null}, ${parsed.data.name},
          ${parsed.data.match_by}, ${parsed.data.priority}, ${parsed.data.active},
          ${JSON.stringify(parsed.data.config ?? {})}::jsonb
        )
        returning *
      `
      return NextResponse.json({ ok: true, rule: rows[0] })
    } catch (err) {
      console.error("[reconciliation/rules] neon insert failed", err)
      return NextResponse.json({ error: "Insert failed" }, { status: 500 })
    }
  }
  const supa = await createClient()
  const { data, error } = await supa
    .from("reconciliation_rules")
    .insert({
      user_id: userId,
      paybill_id: parsed.data.paybill_id ?? null,
      name: parsed.data.name,
      match_by: parsed.data.match_by,
      priority: parsed.data.priority,
      active: parsed.data.active,
      config: parsed.data.config ?? {},
    })
    .select()
    .single()
  if (error) return dbError("reconciliation/rules", error, 500)
  return NextResponse.json({ ok: true, rule: data })
})