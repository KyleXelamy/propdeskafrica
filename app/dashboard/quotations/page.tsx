import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, ClipboardList, ArrowRight, FileText, CheckCircle2, Clock, XCircle } from "lucide-react"

export const metadata: Metadata = {
  title: "Quotations — I-Manage",
  description: "Track contractor quotes side by side. Approve, convert to invoices, pay.",
}

const quotations: Array<{
  id: string
  title: string
  property: string
  contractor: string
  amount: number
  status: string
  variants: number
}> = []

const statusIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  Pending: Clock,
  Approved: CheckCircle2,
  Rejected: XCircle,
  Paid: CheckCircle2,
}
const statusStyle: Record<string, string> = {
  Pending: "bg-warning/15 text-warning",
  Approved: "bg-success/15 text-success",
  Rejected: "bg-destructive/15 text-destructive",
  Paid: "bg-success/15 text-success",
}

export default function QuotationsPage() {
  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quotations</h1>
          <p className="mt-1 text-muted-foreground">
            Compare contractor quotes side by side. Approve with one click. Auto-convert to invoices.
          </p>
        </div>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 size-4" />
          New quote request
        </Button>
      </header>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending approval</CardDescription>
            <CardTitle className="text-3xl">0</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">No pending requests</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Approved this month</CardDescription>
            <CardTitle className="text-3xl">0</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">No approvals recorded</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg. time to approval</CardDescription>
            <CardTitle className="text-3xl">—</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Available after your first request</p>
          </CardContent>
        </Card>
      </div>

      {/* Quotes list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent quotations</CardTitle>
              <CardDescription>Across all your properties.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/maintenance">
                Maintenance <ArrowRight className="ml-1 size-3.5" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            {quotations.length === 0 ? (
              <div className="flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center">
                <ClipboardList className="size-8 text-muted-foreground/60" aria-hidden="true" />
                <p className="mt-3 font-medium">No quotations yet</p>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Create a quote request from a maintenance record to start comparing contractor offers.
                </p>
              </div>
            ) : (
            <table className="min-w-[760px] w-full">
              <thead className="bg-muted/50">
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Quote</th>
                  <th className="px-4 py-3">Property</th>
                  <th className="px-4 py-3">Contractor</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {quotations.map((q) => {
                  const Icon = statusIcon[q.status]
                  return (
                    <tr key={q.id} className="hover:bg-muted/30">
                      <td className="px-4 py-4">
                        <p className="font-mono text-xs text-muted-foreground">{q.id}</p>
                        <p className="mt-1 text-sm font-medium">{q.title}</p>
                      </td>
                      <td className="px-4 py-4 text-sm">{q.property}</td>
                      <td className="px-4 py-4 text-sm">{q.contractor}</td>
                      <td className="px-4 py-4 text-right">
                        <p className="text-sm font-semibold">KES {q.amount.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{q.variants} quotes</p>
                      </td>
                      <td className="px-4 py-4">
                        <Badge className={statusStyle[q.status]}>
                          <Icon className="mr-1 size-3" />
                          {q.status}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            )}
          </div>
        </CardContent>
      </Card>

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle>How quotations work</CardTitle>
          <CardDescription>From request to invoice in four steps.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { n: 1, title: "Request quotes", body: "Pick the issue from a maintenance record. We send it to your contractor list." },
              { n: 2, title: "Compare side-by-side", body: "Multiple quotes show up in the record with line items and totals." },
              { n: 3, title: "Approve with one click", body: "One approval turns the winning quote into a draft invoice." },
              { n: 4, title: "Track and pay", body: "Pay via M-Pesa, attach receipt, mark complete. Linked to the property forever." },
            ].map((s) => (
              <li key={s.n} className="rounded-2xl border bg-card p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Step {s.n}</p>
                <p className="mt-3 text-base font-medium">{s.title}</p>
                <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
