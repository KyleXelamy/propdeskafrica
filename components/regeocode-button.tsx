"use client"

import { useState } from "react"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export function RegeocodeButton() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  async function run() {
    setBusy(true)
    setMessage("")
    try {
      const response = await fetch("/api/properties/geocode", { method: "POST" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Unable to update locations")
      setMessage(`${data.updated} location${data.updated === 1 ? "" : "s"} updated${data.remaining ? ` · ${data.remaining} still need an address match` : ""}`)
      window.location.reload()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update locations")
    } finally {
      setBusy(false)
    }
  }

  return <div className="flex items-center gap-2">
    <Button type="button" variant="outline" size="sm" onClick={run} disabled={busy}>
      <RefreshCw className={`mr-2 size-3.5 ${busy ? "animate-spin" : ""}`} /> {busy ? "Updating locations" : "Update locations"}
    </Button>
    {message && <span className="text-xs text-muted-foreground" role="status">{message}</span>}
  </div>
}
