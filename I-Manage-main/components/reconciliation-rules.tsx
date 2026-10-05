"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { GripVertical, Pause, Play, Settings2, ListOrdered } from "lucide-react"

type Rule = {
  id: string
  name: string
  match_by: "phone" | "account_ref" | "amount_property" | "amount_tenant" | "closest_amount"
  priority: number
  active: boolean
  description: string
}

const seed: Rule[] = [
  {
    id: "r-1",
    name: "Account reference (UUID or short code)",
    match_by: "account_ref",
    priority: 100,
    active: true,
    description: "Match by the BillRefNumber Daraja sends — usually a tenant UUID or short code.",
  },
  {
    id: "r-2",
    name: "Phone number match",
    match_by: "phone",
    priority: 80,
    active: true,
    description: "Match the customer MSISDN to a tenant's stored phone number (last 9 digits).",
  },
  {
    id: "r-3",
    name: "Amount vs tenant expected rent",
    match_by: "amount_tenant",
    priority: 60,
    active: true,
    description: "Match the payment amount against each tenant's expected monthly rent (±2% / ±50 KES).",
  },
  {
    id: "r-4",
    name: "Amount vs property rent (single tenant)",
    match_by: "amount_property",
    priority: 40,
    active: true,
    description: "If a property has exactly one active tenant and the amount matches the property rent.",
  },
  {
    id: "r-5",
    name: "Closest amount heuristic",
    match_by: "closest_amount",
    priority: 20,
    active: false,
    description: "Last-resort: pick the tenant whose expected rent is closest to the payment (>85% closeness).",
  },
]

const methodLabel: Record<Rule["match_by"], string> = {
  account_ref: "Account ref",
  phone: "Phone",
  amount_property: "Amount / property",
  amount_tenant: "Amount / tenant",
  closest_amount: "Closest amount",
}

export function ReconciliationRules() {
  const [rules, setRules] = useState(seed)

  function toggle(id: string) {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r)))
  }

  function move(id: string, dir: -1 | 1) {
    setRules((prev) => {
      const sorted = [...prev].sort((a, b) => b.priority - a.priority)
      const idx = sorted.findIndex((r) => r.id === id)
      const target = idx + dir
      if (idx < 0 || target < 0 || target >= sorted.length) return prev
      const a = sorted[idx]
      const b = sorted[target]
      // swap priorities
      const tmp = a.priority
      return prev.map((r) => {
        if (r.id === a.id) return { ...r, priority: b.priority }
        if (r.id === b.id) return { ...r, priority: tmp }
        return r
      })
    })
  }

  const sorted = [...rules].sort((a, b) => b.priority - a.priority)

  return (
    <ol className="space-y-2">
      {sorted.map((r, i) => (
        <li
          key={r.id}
          className={
            "flex items-start gap-3 rounded-xl border bg-card p-4 transition-colors " +
            (r.active ? "" : "opacity-60")
          }
        >
          <div className="flex flex-col items-center gap-1 pt-1">
            <button
              type="button"
              onClick={() => move(r.id, -1)}
              disabled={i === 0}
              className="text-muted-foreground hover:text-foreground disabled:opacity-30"
              aria-label="Move up"
            >
              ▲
            </button>
            <GripVertical className="size-3.5 text-muted-foreground/40" />
            <button
              type="button"
              onClick={() => move(r.id, 1)}
              disabled={i === sorted.length - 1}
              className="text-muted-foreground hover:text-foreground disabled:opacity-30"
              aria-label="Move down"
            >
              ▼
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="grid size-7 place-items-center rounded-full bg-secondary text-xs font-semibold text-primary">
                {r.priority}
              </span>
              <p className="text-sm font-semibold">{r.name}</p>
              <Badge variant="outline" className="text-[10px]">{methodLabel[r.match_by]}</Badge>
              {!r.active && <Badge variant="outline" className="text-[10px]">Paused</Badge>}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => toggle(r.id)}
              aria-label={r.active ? "Pause rule" : "Resume rule"}
            >
              {r.active ? <Pause className="size-4" /> : <Play className="size-4" />}
            </Button>
            <Button variant="ghost" size="icon" aria-label="Edit rule">
              <Settings2 className="size-4" />
            </Button>
          </div>
        </li>
      ))}
    </ol>
  )
}