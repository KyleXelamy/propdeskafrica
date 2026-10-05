"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Repeat, Play, Pause, AlertCircle, CheckCircle2 } from "lucide-react"
import { apiFetch, ApiError } from "@/lib/api/client"

interface RecurringTemplate {
  id: string
  description: string
  category: string
  amount: number
  vendor: string | null
  recurring_frequency: string
  next_occurrence: string | null
  property_name: string | null
}

export function RecurringExpensesPanel({ templates }: { templates: RecurringTemplate[] }) {
  const [running, setRunning] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const router = useRouter()

  const runAll = async () => {
    setMsg(null)
    setRunning(true)
    try {
      const r = await fetch("/api/expenses/recurring/run", { method: "POST" })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error((data as any).error || "Run failed")
      setMsg({
        type: "success",
        text: `Generated ${data.inserted || 0} expense${data.inserted === 1 ? "" : "s"}.`,
      })
      router.refresh()
    } catch (e: any) {
      setMsg({ type: "error", text: e.message || "Run failed" })
    } finally {
      setRunning(false)
    }
  }

  const toggle = async (t: RecurringTemplate) => {
    setMsg(null)
    setTogglingId(t.id)
    try {
      // Pause = set is_recurring=false. Resume = true.
      const newState = false // we only have "pause" from this panel; resume via the per-row form on the recurring page
      await apiFetch(`/api/expenses/${t.id}`, {
        method: "PUT",
        body: { is_recurring: newState, recurring_frequency: null, next_occurrence: null },
      })
      setMsg({ type: "success", text: "Paused." })
      router.refresh()
    } catch (e: any) {
      const text = e instanceof ApiError ? e.message : e?.message || "Pause failed"
      setMsg({ type: "error", text })
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Repeat className="h-4 w-4" />
              Recurring Templates
            </CardTitle>
            <CardDescription className="text-sm">
              Auto-generated expenses (run daily at 07:05 UTC via pg_cron).
            </CardDescription>
          </div>
          <Button onClick={runAll} disabled={running || templates.length === 0} size="sm">
            {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            Generate now
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {msg && (
          <div
            className={`flex items-start gap-2 p-3 text-sm rounded-md border ${
              msg.type === "error"
                ? "border-destructive/30 bg-destructive/5 text-destructive"
                : "border-chart-4/30 bg-chart-4/5 text-chart-4"
            }`}
          >
            {msg.type === "error" ? (
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
            )}
            <span>{msg.text}</span>
          </div>
        )}

        {templates.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            No recurring expenses set up. Toggle "Make this expense recurring" when creating one.
          </div>
        ) : (
          <ul className="divide-y -mx-2">
            {templates.map((t) => {
              const isOverdue = t.next_occurrence && new Date(t.next_occurrence) <= new Date()
              return (
                <li key={t.id} className="flex items-center justify-between gap-3 px-2 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm flex items-center gap-2">
                      <span className="truncate">{t.description}</span>
                      <Badge variant="secondary" className="text-xs flex-shrink-0">
                        {t.recurring_frequency}
                      </Badge>
                      {isOverdue && (
                        <Badge variant="destructive" className="text-xs flex-shrink-0">due</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {t.category}
                      {t.vendor ? ` · ${t.vendor}` : ""}
                      {t.property_name ? ` · ${t.property_name}` : ""}
                      {t.next_occurrence ? ` · next: ${t.next_occurrence}` : ""}
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <div className="font-medium text-sm tabular-nums">
                      KES {t.amount.toLocaleString()}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggle(t)}
                      disabled={togglingId === t.id}
                      className="h-7 w-7 text-muted-foreground"
                      aria-label="Pause template"
                    >
                      {togglingId === t.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Pause className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
