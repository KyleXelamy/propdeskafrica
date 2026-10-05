"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Repeat, AlertCircle, CheckCircle2 } from "lucide-react"
import { apiFetch, ApiError } from "@/lib/api/client"

interface Props {
  expenseId: string
  initialIsRecurring: boolean
  initialFrequency: string | null
  initialNextOccurrence: string | null
}

export function ExpenseRecurringControl({
  expenseId,
  initialIsRecurring,
  initialFrequency,
  initialNextOccurrence,
}: Props) {
  const [isRecurring, setIsRecurring] = useState(initialIsRecurring)
  const [frequency, setFrequency] = useState(initialFrequency || "monthly")
  const [nextOccurrence, setNextOccurrence] = useState(
    initialNextOccurrence || new Date().toISOString().slice(0, 10),
  )
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const router = useRouter()

  const handleSave = async () => {
    setMsg(null)
    setSaving(true)
    try {
      await apiFetch(`/api/expenses/${expenseId}`, {
        method: "PUT",
        body: {
          is_recurring: isRecurring,
          recurring_frequency: isRecurring ? frequency : null,
          next_occurrence: isRecurring ? nextOccurrence : null,
        },
      })
      setMsg({ type: "success", text: "Saved." })
      router.refresh()
    } catch (e: any) {
      const text = e instanceof ApiError ? e.message : e?.message || "Save failed"
      setMsg({ type: "error", text })
    } finally {
      setSaving(false)
    }
  }

  const handleRunNow = async () => {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Repeat className="h-4 w-4" />
          Recurring Expense
        </CardTitle>
        <CardDescription className="text-sm">
          Automatically create copies of this expense on a schedule.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="is-recurring">Make this expense recurring</Label>
            <p className="text-xs text-muted-foreground">
              New rows are auto-generated; the original stays as the template.
            </p>
          </div>
          <Switch
            id="is-recurring"
            checked={isRecurring}
            onCheckedChange={setIsRecurring}
          />
        </div>

        {isRecurring && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="frequency">Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger id="frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="next-occurrence">Next occurrence</Label>
              <Input
                id="next-occurrence"
                type="date"
                value={nextOccurrence}
                onChange={(e) => setNextOccurrence(e.target.value)}
              />
            </div>
          </div>
        )}

        {msg && (
          <Alert variant={msg.type === "error" ? "destructive" : "default"} className={msg.type === "success" ? "border-chart-4/30 bg-chart-4/5" : ""}>
            {msg.type === "error" ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4 text-chart-4" />}
            <AlertDescription>{msg.text}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save
          </Button>
          <Button variant="outline" onClick={handleRunNow} disabled={running}>
            {running && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Generate due expenses now
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
