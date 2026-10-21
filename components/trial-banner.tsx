"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SubStatus {
  is_active: boolean
  is_trialing: boolean
  trial_expired: boolean
  days_left: number
  plan: string | null
  plan_name: string | null
  reason: string
}


export function TrialBanner() {
  const [status, setStatus] = useState<SubStatus | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/subscription")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setStatus(d) })
      .finally(() => setLoading(false))
  }, [])

  if (loading || !status) return null
  if (dismissed) return null

  // Critical: trial expired / canceled / past_due
  if (status.trial_expired || status.reason === "canceled" || status.reason === "expired" || status.reason === "past_due") {
    return (
      <Alert variant="destructive" className="mb-4">
        <Sparkles className="h-4 w-4" />
        <AlertDescription className="flex flex-wrap items-center justify-between gap-2 w-full">
          <span>
            <strong>Your access is paused.</strong> Pick a plan to resume.
          </span>
          <Button asChild size="sm" variant="outline" className="bg-background text-foreground hover:bg-muted">
            <Link href="/dashboard/billing">Choose plan</Link>
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  // Trialing with time left — show count-down
  if (status.is_trialing && status.days_left > 0) {
    return (
      <Alert className="mb-4 border-primary/30 bg-primary/5">
        <Sparkles className="h-4 w-4 text-primary" />
        <AlertDescription className="flex flex-wrap items-center justify-between gap-2 w-full">
          <span>
            <strong>Your 14-day trial is active</strong> — {status.days_left} day{status.days_left === 1 ? "" : "s"} left on {status.plan_name || "Pro"}.
          </span>
          <div className="flex items-center gap-1">
            <Button asChild size="sm" variant="outline" className="bg-background text-foreground hover:bg-muted">
              <Link href="/dashboard/billing">Upgrade</Link>
            </Button>
            {status.days_left > 3 && (
              <button
                onClick={() => setDismissed(true)}
                className="text-muted-foreground hover:text-foreground p-1"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  return null
}
