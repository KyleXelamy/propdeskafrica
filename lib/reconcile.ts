/**
 * Per-tenant payment reconciliation engine.
 *
 * Given a C2B transaction (paybill / till incoming payment), figure out
 * which tenant it belongs to and create a matching `rent_payments` row.
 *
 * Matching rules are tried in priority order (highest first). When a rule
 * matches, we stop and write the decision to `reconciliation_audit`.
 *
 * If nothing matches, the transaction is left as `match_status = 'unmatched'`
 * and a human can resolve it from /dashboard/paybill.
 */

import { z } from "zod"

export const MatchBy = z.enum([
  "phone",
  "account_ref",
  "amount_property",
  "amount_tenant",
  "closest_amount",
  "manual",
  "unmatched",
])

export type MatchBy = z.infer<typeof MatchBy>

export interface RuleDef {
  id: string
  match_by: MatchBy
  priority: number
  config: {
    amount_tolerance_pct?: number
    amount_tolerance_abs?: number
    only_active_tenants?: boolean
    paybill_id?: string
  }
}

export interface C2BTransaction {
  trans_id: string
  trans_time: string
  trans_amount: number
  business_short_code: string
  bill_ref_number: string
  msisdn: string
  first_name?: string
  last_name?: string
  paybill_id?: string
}

export interface TenantCandidate {
  id: string
  full_name: string
  phone: string
  expected_rent?: number
  property_id: string
  property_rent?: number
  is_active?: boolean
}

export interface MatchResult {
  matched_tenant_id: string | null
  matched_payment_id: string | null
  match_method: MatchBy
  match_confidence: number
  notes: string
}

export interface MatchContext {
  tenants: TenantCandidate[]
  rules: RuleDef[]
  existingPaymentsByTenant?: Map<string, number[]> // open expected amount
}

function normalizePhone(input: string): string {
  return (input || "").replace(/\s+/g, "").replace(/^\+/, "")
}

function phonesMatch(a: string, b: string): boolean {
  if (!a || !b) return false
  const na = normalizePhone(a)
  const nb = normalizePhone(b)
  if (na === nb) return true
  // last-9-digits
  if (na.slice(-9) === nb.slice(-9)) return true
  return false
}

function amountWithinTolerance(
  actual: number,
  expected: number,
  pct = 5,
  abs = 0,
): boolean {
  if (expected <= 0) return false
  const diff = Math.abs(actual - expected)
  return diff <= Math.max(abs, (expected * pct) / 100)
}

function amountCloseness(actual: number, expected: number): number {
  if (expected <= 0) return 0
  const diff = Math.abs(actual - expected)
  return Math.max(0, 1 - diff / expected)
}

/**
 * Try rules in priority order. First match wins. Returns the best
 * `MatchResult` (including no-match).
 */
export function reconcile(
  txn: C2BTransaction,
  ctx: MatchContext,
): MatchResult {
  const sortedRules = [...ctx.rules].sort((a, b) => b.priority - a.priority)

  for (const rule of sortedRules) {
    if (rule.config.paybill_id && rule.config.paybill_id !== txn.paybill_id) continue

    if (rule.match_by === "account_ref") {
      // BillRefNumber carries the tenant account reference.
      // Convention: <tenantId> or <tenantId>-<unitId>
      const ref = (txn.bill_ref_number || "").trim()
      const m = ref.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:-(.+))?$/i)
      if (m) {
        const tenant = ctx.tenants.find((t) => t.id === m[1])
        if (tenant && (!rule.config.only_active_tenants || tenant.is_active !== false)) {
          return {
            matched_tenant_id: tenant.id,
            matched_payment_id: null,
            match_method: "account_ref",
            match_confidence: 0.98,
            notes: `Matched by account reference (${ref}).`,
          }
        }
      }
      // Fall back: maybe BillRefNumber is a tenant short-code
      const tenant = ctx.tenants.find(
        (t) => t.id.slice(0, 8).toLowerCase() === ref.slice(0, 8).toLowerCase(),
      )
      if (tenant) {
        return {
          matched_tenant_id: tenant.id,
          matched_payment_id: null,
          match_method: "account_ref",
          match_confidence: 0.9,
          notes: `Matched by short account reference.`,
        }
      }
    }

    if (rule.match_by === "phone") {
      const tenant = ctx.tenants.find((t) =>
        t.phone && phonesMatch(t.phone, txn.msisdn) &&
        (!rule.config.only_active_tenants || t.is_active !== false),
      )
      if (tenant) {
        return {
          matched_tenant_id: tenant.id,
          matched_payment_id: null,
          match_method: "phone",
          match_confidence: 0.92,
          notes: `Matched by phone (${txn.msisdn}).`,
        }
      }
    }

    if (rule.match_by === "amount_property") {
      const tolerance = {
        pct: rule.config.amount_tolerance_pct ?? 2,
        abs: rule.config.amount_tolerance_abs ?? 50,
      }
      // Group tenants by property
      const byProperty = new Map<string, TenantCandidate[]>()
      for (const t of ctx.tenants) {
        if (!byProperty.has(t.property_id)) byProperty.set(t.property_id, [])
        byProperty.get(t.property_id)!.push(t)
      }
      for (const [propertyId, tenants] of byProperty) {
        const rent = tenants[0]?.property_rent
        if (!rent) continue
        if (!amountWithinTolerance(txn.trans_amount, rent, tolerance.pct, tolerance.abs)) continue
        // If only one active tenant on the property, return them.
        const active = tenants.filter((t) => t.is_active !== false)
        if (active.length === 1) {
          return {
            matched_tenant_id: active[0].id,
            matched_payment_id: null,
            match_method: "amount_property",
            match_confidence: 0.85,
            notes: `Matched by property amount (${propertyId}, KES ${rent}).`,
          }
        }
      }
    }

    if (rule.match_by === "amount_tenant") {
      const tolerance = {
        pct: rule.config.amount_tolerance_pct ?? 2,
        abs: rule.config.amount_tolerance_abs ?? 50,
      }
      for (const t of ctx.tenants) {
        if (!t.expected_rent) continue
        if (amountWithinTolerance(txn.trans_amount, t.expected_rent, tolerance.pct, tolerance.abs)) {
          return {
            matched_tenant_id: t.id,
            matched_payment_id: null,
            match_method: "amount_tenant",
            match_confidence: 0.88,
            notes: `Matched by tenant expected amount (KES ${t.expected_rent}).`,
          }
        }
      }
    }

    if (rule.match_by === "closest_amount") {
      let best: { tenant: TenantCandidate; closeness: number } | null = null
      for (const t of ctx.tenants) {
        const target = t.expected_rent ?? t.property_rent ?? 0
        if (target <= 0) continue
        const closeness = amountCloseness(txn.trans_amount, target)
        if (closeness > 0.85 && (!best || closeness > best.closeness)) {
          best = { tenant: t, closeness }
        }
      }
      if (best) {
        return {
          matched_tenant_id: best.tenant.id,
          matched_payment_id: null,
          match_method: "closest_amount",
          match_confidence: best.closeness,
          notes: `Matched by closest amount (${Math.round(best.closeness * 100)}%).`,
        }
      }
    }
  }

  return {
    matched_tenant_id: null,
    matched_payment_id: null,
    match_method: "unmatched",
    match_confidence: 0,
    notes: "No rule matched.",
  }
}

/**
 * Default ruleset — sensible starting point for new paybills.
 * Stored in DB by default; admins can edit.
 */
export const defaultRules: RuleDef[] = [
  {
    id: "default-account-ref",
    match_by: "account_ref",
    priority: 100,
    config: {},
  },
  {
    id: "default-phone",
    match_by: "phone",
    priority: 80,
    config: { only_active_tenants: true },
  },
  {
    id: "default-amount-tenant",
    match_by: "amount_tenant",
    priority: 60,
    config: { amount_tolerance_pct: 2, amount_tolerance_abs: 50 },
  },
  {
    id: "default-amount-property",
    match_by: "amount_property",
    priority: 40,
    config: { amount_tolerance_pct: 2, amount_tolerance_abs: 50, only_active_tenants: true },
  },
  {
    id: "default-closest",
    match_by: "closest_amount",
    priority: 20,
    config: {},
  },
]
