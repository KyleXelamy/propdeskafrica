import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Wallet, Plus, Copy, RefreshCw, TrendingUp, AlertTriangle } from "lucide-react"
import { LivePaybillFeed } from "@/components/live-paybill-feed"

export const metadata: Metadata = {
  title: "Paybill — I-Manage",
  description: "Configure your paybill and till numbers, monitor every payment in real time.",
}

const paybills = [
  {
    id: "PB-001",
    label: "Karen properties",
    number: "247247",
    type: "Paybill",
    property: "Karen House 1, 2, 3",
    matched: 412,
    unmatched: 0,
    lastPayment: "2 minutes ago",
  },
  {
    id: "PB-002",
    label: "Riverside",
    number: "456456",
    type: "Till",
    property: "Riverside Apartments",
    matched: 184,
    unmatched: 1,
    lastPayment: "32 minutes ago",
  },
  {
    id: "PB-003",
    label: "Westlands Studio",
    number: "789012",
    type: "Till",
    property: "Westlands Studio",
    matched: 86,
    unmatched: 0,
    lastPayment: "1 hour ago",
  },
]

export default function PaybillPage() {
  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Paybill</h1>
          <p className="mt-1 text-muted-foreground">
            Configure your Safaricom paybill &amp; till numbers. We detect, match and reconcile every payment.
          </p>
        </div>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 size-4" /> Add paybill
        </Button>
      </header>

      {/* Top stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Payments this month</CardDescription>
            <CardTitle className="text-3xl">682</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-success">+8.2% vs last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Auto-matched</CardDescription>
            <CardTitle className="text-3xl">99.7%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">680 of 682</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total collected</CardDescription>
            <CardTitle className="text-3xl">KES 3.84M</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Across all paybills</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Unmatched</CardDescription>
            <CardTitle className="text-3xl">2</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-warning">Need attention</p>
          </CardContent>
        </Card>
      </div>

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle>How paybill matching works</CardTitle>
          <CardDescription>Three simple steps.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-4 lg:grid-cols-3">
            {[
              {
                n: 1,
                title: "Add your paybill",
                body: "Paste your paybill / till number and the C2B validation URL we give you to Daraja. Done once.",
              },
              {
                n: 2,
                title: "Tenants pay normally",
                body: "Tenants pay to your number via the M-Pesa menu — no app, no login, no friction. The account reference carries the tenant ID.",
              },
              {
                n: 3,
                title: "It just shows up",
                body: "Payments land in your I-Manage dashboard within 60 seconds, matched to the right tenant, property and lease.",
              },
            ].map((s) => (
              <li key={s.n} className="rounded-2xl border bg-card p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Step {s.n}</p>
                <p className="mt-3 text-lg font-semibold">{s.title}</p>
                <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Paybills */}
      <Card>
        <CardHeader>
          <CardTitle>Your paybills &amp; tills</CardTitle>
          <CardDescription>One entry per Safaricom account number you own.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Account</th>
                  <th className="px-4 py-3">Properties</th>
                  <th className="px-4 py-3 text-right">Matched</th>
                  <th className="px-4 py-3">Last payment</th>
                  <th className="px-4 py-3">Health</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paybills.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 place-items-center rounded-full bg-secondary text-primary">
                          <Wallet className="size-4" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold">{p.label}</p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {p.type} · {p.number}
                            <button className="ml-2 inline-flex items-center text-muted-foreground hover:text-primary" aria-label="Copy">
                              <Copy className="size-3" />
                            </button>
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm">{p.property}</td>
                    <td className="px-4 py-4 text-right">
                      <p className="text-sm font-semibold">{p.matched}</p>
                      {p.unmatched > 0 ? (
                        <p className="text-xs text-warning">{p.unmatched} unmatched</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">All matched</p>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">{p.lastPayment}</td>
                    <td className="px-4 py-4">
                      {p.unmatched === 0 ? (
                        <Badge className="bg-success/15 text-success">
                          <TrendingUp className="mr-1 size-3" /> Healthy
                        </Badge>
                      ) : (
                        <Badge className="bg-warning/15 text-warning">
                          <AlertTriangle className="mr-1 size-3" /> Needs attention
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button variant="outline" size="sm">
              <RefreshCw className="mr-2 size-3.5" /> Re-sync from Daraja
            </Button>
          </div>
        </CardContent>
      </Card>

      <LivePaybillFeed />
    </div>
  )
}