import { describe, expect, it } from "vitest"
import { reconcile } from "./reconcile"
import type { C2BTransaction, MatchContext, TenantCandidate } from "./reconcile"

const transaction: C2BTransaction = {
  trans_id: "TX-001",
  trans_time: "2026-10-19 10:00:00",
  trans_amount: 12500,
  business_short_code: "123456",
  bill_ref_number: "",
  msisdn: "254712345678",
}

const tenant: TenantCandidate = {
  id: "tenant-1",
  full_name: "Ada K.",
  phone: "+254 712 345 678",
  expected_rent: 12500,
  property_id: "property-1",
  property_rent: 12500,
  is_active: true,
}

const context = (rules: MatchContext["rules"], tenants = [tenant]): MatchContext => ({
  tenants,
  rules,
})

describe("reconcile", () => {
  it("matches a payment by phone before amount rules", () => {
    const result = reconcile(transaction, context([
      { id: "phone", match_by: "phone", priority: 80, config: {} },
      { id: "amount", match_by: "amount_tenant", priority: 60, config: {} },
    ]))

    expect(result).toMatchObject({
      matched_tenant_id: "tenant-1",
      match_method: "phone",
      match_confidence: 0.92,
    })
  })

  it("does not match a phone rule to an inactive tenant when configured", () => {
    const result = reconcile(transaction, context([
      { id: "phone", match_by: "phone", priority: 80, config: { only_active_tenants: true } },
    ], [{ ...tenant, is_active: false }]))

    expect(result.match_method).toBe("unmatched")
  })

  it("matches by expected amount when no identifying detail exists", () => {
    const result = reconcile({ ...transaction, msisdn: "254700000000" }, context([
      { id: "amount", match_by: "amount_tenant", priority: 60, config: {} },
    ]))

    expect(result).toMatchObject({ matched_tenant_id: "tenant-1", match_method: "amount_tenant" })
  })
})
