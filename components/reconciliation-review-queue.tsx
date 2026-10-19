"use client"

import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CheckCircle2, Loader2, Search, XCircle } from "lucide-react"

type Match = { id: string; billRef: string; amount: number; tenant: string; tenantId?: string; method: string; confidence: number; status: string }
type Tenant = { id: string; full_name: string }

type Props = { matches: Match[]; tenants: Tenant[]; methodLabel: Record<string, string> }

export function ReconciliationReviewQueue({ matches, tenants, methodLabel }: Props) {
  const [query, setQuery] = useState("")
  const [selectedTenant, setSelectedTenant] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<"all" | "matched" | "review">("all")
  const [working, setWorking] = useState<string | null>(null)
  const [message, setMessage] = useState("")
  const visible = useMemo(() => matches.filter((match) => {
    const haystack = `${match.id} ${match.billRef} ${match.tenant}`.toLowerCase()
    const statusMatches = status === "all" || (status === "matched" ? match.status === "matched" : match.status !== "matched")
    return statusMatches && haystack.includes(query.toLowerCase())
  }), [matches, query, status])

  async function resolve(id: string, decision: "matched" | "rejected") {
    setWorking(id)
    setMessage("")
    const endpoint = decision === "matched" ? "/api/reconciliation/resolve" : "/api/reconciliation/resolve"
    const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ trans_id: id, decision, tenant_id: selectedTenant[id] || undefined }) })
    const body = await response.json().catch(() => ({}))
    setWorking(null)
    setMessage(response.ok ? "Decision recorded. Refresh to see the updated queue." : body.error || "Unable to record decision.")
  }

  return <div className="space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-xs"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search transaction, reference, tenant" className="pl-9" /></div>
      <div className="flex gap-1 rounded-lg border p-1" role="group" aria-label="Filter reconciliation decisions">
        {(["all", "review", "matched"] as const).map((item) => <Button key={item} type="button" size="sm" variant={status === item ? "secondary" : "ghost"} onClick={() => setStatus(item)}>{item === "all" ? "All" : item === "review" ? "Needs review" : "Matched"}</Button>)}
      </div>
    </div>
    {message && <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground" role="status">{message}</p>}
    {visible.length === 0 ? <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No transactions match this view.</p> : <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[860px]"><thead className="bg-muted/50"><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="px-4 py-3">Transaction</th><th className="px-4 py-3">Bill ref</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Tenant</th><th className="px-4 py-3">Method</th><th className="px-4 py-3 text-right">Confidence</th><th className="px-4 py-3">Decision</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y">{visible.map((match) => <tr key={match.id} className="hover:bg-muted/30"><td className="px-4 py-4 font-mono text-xs">{match.id}</td><td className="px-4 py-4 font-mono text-xs text-muted-foreground">{match.billRef}</td><td className="px-4 py-4 text-right text-sm font-semibold">KES {match.amount.toLocaleString()}</td><td className="px-4 py-4 text-sm">{match.tenant}</td><td className="px-4 py-4 text-sm">{methodLabel[match.method] || match.method}</td><td className="px-4 py-4 text-right font-mono text-xs">{match.confidence > 0 ? `${Math.round(match.confidence * 100)}%` : "—"}</td><td className="px-4 py-4">{match.status === "matched" ? <Badge className="bg-success/15 text-success"><CheckCircle2 className="mr-1 size-3" />Matched</Badge> : <Badge className="bg-warning/15 text-warning"><XCircle className="mr-1 size-3" />Needs review</Badge>}</td><td className="px-4 py-4 text-right">{match.status !== "matched" && <div className="flex items-center justify-end gap-2"><select aria-label={`Tenant for ${match.id}`} value={selectedTenant[match.id] || match.tenantId || ""} onChange={(event) => setSelectedTenant((current) => ({ ...current, [match.id]: event.target.value }))} className="h-9 max-w-[180px] rounded-md border bg-background px-2 text-xs"><option value="">Select tenant</option>{tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.full_name}</option>)}</select><Button size="sm" variant="outline" disabled={working === match.id} onClick={() => resolve(match.id, "rejected")}>Reject</Button><Button size="sm" disabled={working === match.id || !(selectedTenant[match.id] || match.tenantId)} onClick={() => resolve(match.id, "matched")}>{working === match.id ? <Loader2 className="size-3 animate-spin" /> : "Confirm"}</Button></div>}</td></tr>)}</tbody></table></div>}
  </div>
}
