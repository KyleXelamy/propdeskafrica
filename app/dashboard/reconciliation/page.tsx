import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, CheckCircle2, XCircle, Settings2, ListOrdered } from "lucide-react"
import Link from "next/link"
import { ReconciliationRules } from "@/components/reconciliation-rules"
import { ReconciliationReviewQueue } from "@/components/reconciliation-review-queue"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Reconciliation — PropDesk Africa",
  description: "Per-tenant rules that match incoming paybill payments to the right tenant.",
}

type RecentMatch = { id: string; billRef: string; amount: number; tenant: string; tenantId?: string; method: string; confidence: number; status: string }
type TenantOption = { id: string; full_name: string }

const methodLabel: Record<string, string> = {
  account_ref: "Account ref",
  phone: "Phone",
  amount_tenant: "Amount / tenant",
  amount_property: "Amount / property",
  closest_amount: "Closest amount",
  manual: "Manual",
  unmatched: "Unmatched",
}

export const dynamic = "force-dynamic"

export default async function ReconciliationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const [{ data: transactions }, { count: activeRules }, { data: tenantOptions }, { data: auditEvents }] = await Promise.all([
    supabase.from("c2b_transactions").select("id, trans_id, trans_amount, bill_ref_number, matched_tenant_id, match_method, match_confidence, match_status, created_at, tenants(full_name)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    supabase.from("reconciliation_rules").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("active", true),
    supabase.from("tenants").select("id, full_name").eq("user_id", user.id).eq("is_active", true).order("full_name"),
    supabase.from("reconciliation_audit").select("id, decision, notes, created_at, matched_tenant_id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(8),
  ])

  const recentMatches: RecentMatch[] = (transactions || []).map((transaction: any) => ({
    id: transaction.trans_id || transaction.id,
    billRef: transaction.bill_ref_number || "—",
    amount: Number(transaction.trans_amount || 0),
    tenant: transaction.tenants?.full_name || "—",
    tenantId: transaction.matched_tenant_id || undefined,
    method: transaction.match_method || "unmatched",
    confidence: Number(transaction.match_confidence || 0),
    status: transaction.match_status || "pending",
  }))
  const matched = recentMatches.filter((m) => m.status === "matched").length
  const unmatched = recentMatches.filter((m) => m.status === "unmatched" || m.status === "pending").length
  const total = recentMatches.length
  const matchRate = total > 0 ? Math.round((matched / total) * 1000) / 10 : 0

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reconciliation</h1>
          <p className="mt-1 text-muted-foreground">
            Define how incoming paybill / till payments get matched to tenants. Higher priority rules run first.
          </p>
        </div>
        <Button variant="outline">
          <Settings2 className="mr-2 size-4" /> Default rules
        </Button>
      </header>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Match rate (24h)</CardDescription>
            <CardTitle className="text-3xl">{matchRate}%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Based on recorded transactions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Auto-matched</CardDescription>
            <CardTitle className="text-3xl">{matched}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">of {total} recent</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Unmatched (manual review)</CardDescription>
            <CardTitle className="text-3xl text-warning">{unmatched}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">In the last 24h</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active rules</CardDescription>
            <CardTitle className="text-3xl">{activeRules || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Default ruleset</p>
          </CardContent>
        </Card>
      </div>

      {/* Rules */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Reconciliation rules</CardTitle>
              <CardDescription>Priority 100 runs first. Disabled rules are skipped.</CardDescription>
            </div>
            <Button size="sm">
              <ListOrdered className="mr-2 size-3.5" /> New rule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ReconciliationRules />
        </CardContent>
      </Card>

      {/* Recent activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent reconciliation decisions</CardTitle>
          <CardDescription>Every match is logged. Click a row to inspect.</CardDescription>
        </CardHeader>
        <CardContent>
          <ReconciliationReviewQueue matches={recentMatches} tenants={(tenantOptions || []) as TenantOption[]} methodLabel={methodLabel} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Decision history</CardTitle>
          <CardDescription>Recent manual and automated decisions retained for review.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(auditEvents || []).length === 0 ? <p className="text-sm text-muted-foreground">No decisions have been recorded yet.</p> : (auditEvents || []).map((event) => <div key={event.id} className="flex items-center justify-between gap-4 rounded-lg border p-3 text-sm"><div><p className="font-medium capitalize">{String(event.decision).replace(/_/g, " ")}</p><p className="text-xs text-muted-foreground">{event.notes || "Decision recorded"}</p></div><time className="shrink-0 text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}</time></div>)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How matching works</CardTitle>
          <CardDescription>The engine runs rules top-down. First match wins.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Each incoming payment is evaluated against the active rule set, in priority order. The
            first rule that confidently identifies a tenant wins; the engine stops there.
          </p>
          <p>
            Unmatched payments land in your <Link href="/dashboard/paybill" className="text-primary underline">Paybill inbox</Link>{" "}
            for manual review. You can manually assign or fix the rule and re-run.
          </p>
          <p className="flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-2 text-warning">
            <AlertTriangle className="size-4" />
            Adjusting rules retroactively re-runs only future transactions. Past matches stay as logged.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
