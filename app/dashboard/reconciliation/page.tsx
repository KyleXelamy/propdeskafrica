import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, CheckCircle2, XCircle, Settings2, ListOrdered } from "lucide-react"
import Link from "next/link"
import { ReconciliationRules } from "@/components/reconciliation-rules"

export const metadata: Metadata = {
  title: "Reconciliation — I-Manage",
  description: "Per-tenant rules that match incoming paybill payments to the right tenant.",
}

const recentMatches = [
  { id: "TX-9081", billRef: "B3F2-9A1C-4D7E", amount: 25000, tenant: "Brian Mwangi", method: "account_ref", confidence: 0.98, status: "matched", time: "2 min ago" },
  { id: "TX-9080", billRef: "—", amount: 18000, tenant: "—", method: "phone", confidence: 0.92, status: "matched", time: "14 min ago" },
  { id: "TX-9079", billRef: "—", amount: 32000, tenant: "Aisha Otieno", method: "amount_tenant", confidence: 0.88, status: "matched", time: "23 min ago" },
  { id: "TX-9078", billRef: "—", amount: 22000, tenant: "—", method: "unmatched", confidence: 0, status: "unmatched", time: "1 hr ago" },
  { id: "TX-9077", billRef: "C4A1-2B5D", amount: 14000, tenant: "Joseph Kamau", method: "account_ref", confidence: 0.98, status: "matched", time: "2 hr ago" },
]

const methodLabel: Record<string, string> = {
  account_ref: "Account ref",
  phone: "Phone",
  amount_tenant: "Amount / tenant",
  amount_property: "Amount / property",
  closest_amount: "Closest amount",
  manual: "Manual",
  unmatched: "Unmatched",
}

export default function ReconciliationPage() {
  const matched = recentMatches.filter((m) => m.status === "matched").length
  const unmatched = recentMatches.filter((m) => m.status === "unmatched").length
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
            <p className="text-xs text-success">+1.2 pts vs last week</p>
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
            <CardTitle className="text-3xl">5</CardTitle>
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
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Transaction</th>
                  <th className="px-4 py-3">Bill ref</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Tenant</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3 text-right">Confidence</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentMatches.map((m) => (
                  <tr key={m.id} className="hover:bg-muted/30">
                    <td className="px-4 py-4 font-mono text-xs">{m.id}</td>
                    <td className="px-4 py-4 font-mono text-xs text-muted-foreground">
                      {m.billRef}
                    </td>
                    <td className="px-4 py-4 text-right text-sm font-semibold">
                      KES {m.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-sm">
                      {m.tenant === "—" ? <span className="text-muted-foreground">—</span> : m.tenant}
                    </td>
                    <td className="px-4 py-4 text-sm">{methodLabel[m.method]}</td>
                    <td className="px-4 py-4 text-right">
                      <span className="font-mono text-xs">
                        {m.confidence > 0 ? Math.round(m.confidence * 100) + "%" : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {m.status === "matched" ? (
                        <Badge className="bg-success/15 text-success">
                          <CheckCircle2 className="mr-1 size-3" /> Matched
                        </Badge>
                      ) : (
                        <Badge className="bg-warning/15 text-warning">
                          <XCircle className="mr-1 size-3" /> Unmatched
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
