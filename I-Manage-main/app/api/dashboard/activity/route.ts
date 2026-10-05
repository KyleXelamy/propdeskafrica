import { withAuth, successResponse } from "@/lib/api"

/**
 * GET /api/dashboard/activity
 * Returns the most recent items across payments, expenses, maintenance,
 * and notes — a single chronologically-ordered feed for the dashboard.
 */
export const GET = withAuth(async (_req, { supabase, userId }) => {
  const [payments, expenses, maintenance, notes] = await Promise.all([
    supabase.from("rent_payments")
      .select("id, amount, status, payment_date, created_at, tenants(full_name, first_name, last_name), properties(name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("expenses")
      .select("id, amount, description, category, expense_date, created_at, properties(name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("maintenance_requests")
      .select("id, title, status, priority, created_at, properties(name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("notes")
      .select("id, title, content, category, created_at, properties(name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5),
  ])

  type ActivityItem = {
    type: "payment" | "expense" | "maintenance" | "note"
    id: string
    timestamp: string
    title: string
    subtitle: string
    href: string
    badge?: string
    badgeTone?: "default" | "success" | "warning" | "destructive" | "muted"
    amount?: number
  }

  const tenantName = (t: any) =>
    t?.full_name || [t?.first_name, t?.last_name].filter(Boolean).join(" ") || "—"
  const propName = (p: any) => p?.name || "—"

  const items: ActivityItem[] = []

  ;(payments.data || []).forEach((p: any) =>
    items.push({
      type: "payment",
      id: `payment-${p.id}`,
      timestamp: p.created_at,
      title: `Payment ${p.status === "paid" || p.status === "completed" ? "received" : p.status === "pending" ? "due" : p.status}`,
      subtitle: `${tenantName(p.tenants)} · ${propName(p.properties)}`,
      href: "/dashboard/finances",
      badge: p.status,
      badgeTone: p.status === "paid" || p.status === "completed" ? "success" : p.status === "late" || p.status === "failed" ? "destructive" : "warning",
      amount: Number(p.amount || 0),
    }),
  )

  ;(expenses.data || []).forEach((e: any) =>
    items.push({
      type: "expense",
      id: `expense-${e.id}`,
      timestamp: e.created_at,
      title: `Expense: ${e.description || e.category}`,
      subtitle: `${e.category}${e.properties?.name ? ` · ${propName(e.properties)}` : ""}`,
      href: "/dashboard/finances",
      badge: "expense",
      badgeTone: "muted",
      amount: -Number(e.amount || 0),
    }),
  )

  ;(maintenance.data || []).forEach((m: any) =>
    items.push({
      type: "maintenance",
      id: `maintenance-${m.id}`,
      timestamp: m.created_at,
      title: m.title || "Maintenance request",
      subtitle: propName(m.properties),
      href: `/dashboard/maintenance/${m.id}`,
      badge: m.status,
      badgeTone: m.status === "completed" ? "success" : m.status === "open" ? "warning" : "default",
    }),
  )

  ;(notes.data || []).forEach((n: any) =>
    items.push({
      type: "note",
      id: `note-${n.id}`,
      timestamp: n.created_at,
      title: n.title || "Note",
      subtitle: (n.content || "").slice(0, 80) || propName(n.properties),
      href: `/dashboard/notes/${n.id}`,
      badge: n.category,
      badgeTone: "muted",
    }),
  )

  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  return successResponse(items.slice(0, 15))
})
