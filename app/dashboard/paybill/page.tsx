"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Wallet, TrendingUp, AlertTriangle, Loader2 } from "lucide-react"
import { LivePaybillFeed } from "@/components/live-paybill-feed"
import { PaybillAccountForm } from "@/components/paybill-account-form"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"

export default function PaybillPage() {
  const [paybills, setPaybills] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const [paybillsResult, transactionsResult] = await Promise.all([
        supabase.from("paybills").select("id, label, number, type, active, created_at").order("created_at", { ascending: false }),
        supabase.from("c2b_transactions").select("id, paybill_id, trans_amount, match_status, created_at").order("created_at", { ascending: false }),
      ])
      if (paybillsResult.error || transactionsResult.error) {
        setError(paybillsResult.error?.message || transactionsResult.error?.message || "Could not load paybill data")
      } else {
        setPaybills(paybillsResult.data || [])
        setTransactions(transactionsResult.data || [])
      }
      setLoading(false)
    }
    load()
  }, [])

  const matched = transactions.filter((t) => t.match_status === "matched")
  const unmatched = transactions.filter((t) => t.match_status !== "matched")
  const totalCollected = transactions.reduce((sum, t) => sum + Number(t.trans_amount || 0), 0)

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Paybill</h1>
          <p className="mt-1 text-muted-foreground">
            Configure your Safaricom paybill &amp; till numbers. We detect, match and reconcile every payment.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">Paybill records come from your database.</p>
      </header>

      {/* Top stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Payments this month</CardDescription>
            <CardTitle className="text-3xl">{transactions.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Recorded transactions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Auto-matched</CardDescription>
            <CardTitle className="text-3xl">{transactions.length ? `${Math.round((matched.length / transactions.length) * 1000) / 10}%` : "0%"}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{matched.length} of {transactions.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total collected</CardDescription>
            <CardTitle className="text-3xl">KES {totalCollected.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Across all paybills</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Unmatched</CardDescription>
            <CardTitle className="text-3xl">{unmatched.length}</CardTitle>
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
                body: "Payments land in your PropDesk Africa dashboard within 60 seconds, matched to the right tenant, property and lease.",
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

      <PaybillAccountForm />

      {/* Paybills */}
      {error && <Card className="border-destructive/50 bg-destructive/5"><CardContent className="pt-6 text-sm text-destructive">{error}</CardContent></Card>}

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
                {loading ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center"><Loader2 className="mx-auto size-5 animate-spin" /></td></tr>
                ) : paybills.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No paybills configured yet.</td></tr>
                ) : paybills.map((p) => {
                  const paybillTransactions = transactions.filter((t) => t.paybill_id === p.id)
                  const paybillUnmatched = paybillTransactions.filter((t) => t.match_status !== "matched").length
                  return (
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

                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">Configured account</td>
                    <td className="px-4 py-4 text-right">
                      <p className="text-sm font-semibold">{paybillTransactions.length - paybillUnmatched}</p>
                      {paybillUnmatched > 0 ? (
                        <p className="text-xs text-warning">{paybillUnmatched} unmatched</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">All matched</p>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">
                      {paybillTransactions[0]?.created_at ? new Date(paybillTransactions[0].created_at).toLocaleString() : "No payments"}
                    </td>
                    <td className="px-4 py-4">
                      {paybillUnmatched === 0 ? (
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
                  )
                })}
              </tbody>
            </table>
          </div>

        </CardContent>
      </Card>

      <LivePaybillFeed />
    </div>
  )
}
