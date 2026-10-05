"use client"

import { useState } from "react"
import { ArrowUp, MessageSquare } from "lucide-react"

type Status = "Under review" | "Planned" | "In progress" | "Shipped"

type Request = {
  id: string
  title: string
  body: string
  status: Status
  votes: number
  category: string
}

const seed: Request[] = [
  { id: "r-001", title: "Bulk send rent invoices on the 1st", body: "Schedule all rent invoices to be sent automatically on the 1st of each month.", status: "Shipped", votes: 412, category: "Payments" },
  { id: "r-002", title: "WhatsApp tenant bot", body: "Pay rent, raise maintenance and get receipts from WhatsApp — no portal login needed.", status: "Planned", votes: 340, category: "Tenant" },
  { id: "r-003", title: "AI rent-default prediction", body: "Surface tenants likely to default 30 days out, with a suggested action.", status: "In progress", votes: 287, category: "Reporting" },
  { id: "r-004", title: "Multi-currency reporting", body: "See portfolio value in USD while collecting in local currency.", status: "Under review", votes: 198, category: "Reporting" },
  { id: "r-005", title: "Custom report builder", body: "Build bespoke reports without contacting support.", status: "Under review", votes: 165, category: "Reporting" },
  { id: "r-006", title: "Maintenance contractor portal", body: "Dedicated experience for contractors to view assigned jobs, update status, send invoices.", status: "Planned", votes: 154, category: "Core" },
  { id: "r-007", title: "Stripe Connect for international rent", body: "For landlords with tenants abroad, accept USD/EUR rent via Stripe.", status: "Under review", votes: 122, category: "Payments" },
  { id: "r-008", title: "Two-factor authentication", body: "TOTP-based 2FA for landlord accounts.", status: "In progress", votes: 98, category: "Security" },
]

const statusStyles: Record<Status, string> = {
  "Under review": "bg-muted text-muted-foreground",
  Planned: "bg-primary text-primary-foreground",
  "In progress": "bg-warning/15 text-warning",
  Shipped: "bg-success/15 text-success",
}

export function FeedbackBoard() {
  const [items, setItems] = useState(seed)
  const [voted, setVoted] = useState<Set<string>>(new Set())

  function vote(id: string) {
    if (voted.has(id)) return
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, votes: r.votes + 1 } : r)))
    setVoted((prev) => new Set(prev).add(id))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {(["Under review", "Planned", "In progress", "Shipped"] as Status[]).map((s, i) => (
            <span key={s} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${statusStyles[s]}`}>
              {s}
            </span>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">Sort by votes:</p>
      </div>

      <ul className="space-y-3">
        {items.map((r) => (
          <li
            key={r.id}
            className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5"
          >
            <button
              type="button"
              onClick={() => vote(r.id)}
              disabled={voted.has(r.id)}
              className={
                "flex shrink-0 flex-col items-center justify-center rounded-xl border border-border px-3 py-2 text-xs font-semibold " +
                (voted.has(r.id)
                  ? "bg-muted text-muted-foreground"
                  : "bg-background hover:border-primary hover:text-primary")
              }
              aria-label={`Upvote ${r.title}`}
            >
              <ArrowUp className="size-4" />
              <span className="mt-1">{r.votes}</span>
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${statusStyles[r.status]}`}>
                  {r.status}
                </span>
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  {r.category}
                </span>
              </div>
              <p className="mt-2 text-base font-medium leading-tight">{r.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>
              <button
                type="button"
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                <MessageSquare className="size-3" /> 0 comments
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}