import { withAuth, successResponse } from "@/lib/api"
import type { NextRequest } from "next/server"

/**
 * GET /api/reports?month=YYYY-MM
 *
 * Returns aggregated stats for the Reports page. The Reports page also
 * does its own calculations server-side using direct DB queries, so
 * this endpoint exists primarily for the future client-side reporting
 * layer and to keep all of the data in one place.
 */
export const GET = withAuth(async (req: NextRequest, { supabase, userId }) => {
  const { searchParams } = new URL(req.url)
  const now = new Date()
  const month = searchParams.get("month")
  const year = searchParams.get("year")

  let refDate = now
  if (month) {
    const [y, m] = month.split("-").map(Number)
    if (y && m) refDate = new Date(Date.UTC(y, m - 1, 1))
  } else if (year) {
    refDate = new Date(Date.UTC(Number(year), 0, 1))
  }

  const firstOfMonth = new Date(Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth(), 1))
  const lastOfMonth = new Date(Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth() + 1, 0, 23, 59, 59))
  const firstPrev = new Date(Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth() - 1, 1))
  const lastPrev = new Date(Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth(), 0, 23, 59, 59))

  const [
    currentPayments,
    prevPayments,
    currentExpenses,
    prevExpenses,
    properties,
    tenants,
    maintenance,
    historyPayments,
    historyExpenses,
  ] = await Promise.all([
    supabase.from("rent_payments").select("amount, status").eq("user_id", userId)
      .gte("due_date", firstOfMonth.toISOString()).lte("due_date", lastOfMonth.toISOString()),
    supabase.from("rent_payments").select("amount, status").eq("user_id", userId)
      .gte("due_date", firstPrev.toISOString()).lte("due_date", lastPrev.toISOString()),
    supabase.from("expenses").select("amount, category").eq("user_id", userId)
      .gte("expense_date", firstOfMonth.toISOString()).lte("expense_date", lastOfMonth.toISOString()),
    supabase.from("expenses").select("amount, category").eq("user_id", userId)
      .gte("expense_date", firstPrev.toISOString()).lte("expense_date", lastPrev.toISOString()),
    supabase.from("properties").select("id, status").eq("user_id", userId),
    supabase.from("tenants").select("id, status").eq("user_id", userId),
    supabase.from("maintenance_requests").select("id, status, priority").eq("user_id", userId),
    // 6-month trailing history (for the trend line)
    supabase.from("rent_payments").select("amount, status, due_date").eq("user_id", userId)
      .gte("due_date", new Date(Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth() - 5, 1)).toISOString())
      .lte("due_date", lastOfMonth.toISOString()),
    supabase.from("expenses").select("amount, expense_date").eq("user_id", userId)
      .gte("expense_date", new Date(Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth() - 5, 1)).toISOString())
      .lte("expense_date", lastOfMonth.toISOString()),
  ])

  const sum = (rows: { amount: number }[] | null, filter?: (r: any) => boolean) =>
    (rows || []).filter((r) => !filter || filter(r)).reduce((s, r) => s + Number(r.amount || 0), 0)

  const currentRentCollected = sum(currentPayments.data, (p) => p.status === "paid" || p.status === "completed")
  const currentTotalExpenses = sum(currentExpenses.data)
  const currentNetIncome = currentRentCollected - currentTotalExpenses

  const prevRentCollected = sum(prevPayments.data, (p) => p.status === "paid" || p.status === "completed")
  const prevTotalExpenses = sum(prevExpenses.data)
  const prevNetIncome = prevRentCollected - prevTotalExpenses

  const pct = (curr: number, prev: number) => (prev !== 0 ? ((curr - prev) / Math.abs(prev)) * 100 : 0)

  const totalProperties = properties.data?.length || 0
  const occupiedProperties = properties.data?.filter((p) => p.status === "occupied").length || 0
  const occupancyRate = totalProperties > 0 ? (occupiedProperties / totalProperties) * 100 : 0
  const activeTenants = tenants.data?.filter((t) => t.status === "active").length || 0
  const openMaintenance = maintenance.data?.filter((m) => m.status === "open").length || 0
  const urgentMaintenance = maintenance.data?.filter((m) => m.priority === "urgent").length || 0

  // expense breakdown by category
  const byCategory: Record<string, number> = {}
  ;(currentExpenses.data || []).forEach((e) => {
    const cat = e.category || "other"
    byCategory[cat] = (byCategory[cat] || 0) + Number(e.amount || 0)
  })

  // 6-month trailing series (oldest first). Each point is the month-bucket
  // totals; "net" is payments - expenses.
  const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  const last6 = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth() - 5 + i, 1))
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth(),
      key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
      label: `${MONTH_SHORT[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`,
      payments: 0,
      expenses: 0,
      net: 0,
    }
  })
  const byKey: Record<string, typeof last6[number]> = {}
  last6.forEach((p) => (byKey[p.key] = p))
  const bucketKey = (iso: string) => iso.slice(0, 7)

  ;(historyPayments.data || []).forEach((p) => {
    if (p.status !== "paid" && p.status !== "completed") return
    const slot = byKey[bucketKey(p.due_date)]
    if (!slot) return
    slot.payments += Number(p.amount || 0)
  })
  ;(historyExpenses.data || []).forEach((e) => {
    const slot = byKey[bucketKey(e.expense_date)]
    if (!slot) return
    slot.expenses += Number(e.amount || 0)
  })
  last6.forEach((p) => (p.net = p.payments - p.expenses))
  // shape for the chart (only label + numbers)
  const trend = last6.map(({ label, payments, expenses, net }) => ({ month: label, payments, expenses, net }))

  return successResponse({
    period: { month: firstOfMonth.toISOString(), previousMonth: firstPrev.toISOString() },
    financial: {
      current: {
        rentCollected: currentRentCollected,
        expenses: currentTotalExpenses,
        netIncome: currentNetIncome,
      },
      previous: {
        rentCollected: prevRentCollected,
        expenses: prevTotalExpenses,
        netIncome: prevNetIncome,
      },
      change: {
        rentPct: pct(currentRentCollected, prevRentCollected),
        expensePct: pct(currentTotalExpenses, prevTotalExpenses),
        netIncomePct: pct(currentNetIncome, prevNetIncome),
      },
      byCategory,
    },
    trend,
    properties: { total: totalProperties, occupied: occupiedProperties, occupancyRate },
    tenants: { active: activeTenants },
    maintenance: { open: openMaintenance, urgent: urgentMaintenance },
  })
})
