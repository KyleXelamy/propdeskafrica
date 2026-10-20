"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

export function SubscriptionControls({ canceled }: { canceled: boolean }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  async function update(action: "cancel" | "reactivate") {
    if (action === "cancel" && !window.confirm("Cancel at the end of your current billing period?")) return
    setBusy(true)
    setError("")
    const response = await fetch("/api/subscription", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ [action]: true }) })
    if (!response.ok) setError("We could not update your subscription. Please try again.")
    else router.refresh()
    setBusy(false)
  }

  return <div className="space-y-2">
    <Button type="button" variant="outline" disabled={busy} onClick={() => update(canceled ? "reactivate" : "cancel")}>
      {busy ? "Updating…" : canceled ? "Reactivate subscription" : "Cancel at period end"}
    </Button>
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  </div>
}
