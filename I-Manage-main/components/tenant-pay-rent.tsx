"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Smartphone, CheckCircle2, AlertCircle } from "lucide-react"
import { apiFetch, ApiError } from "@/lib/api/client"

interface Props {
  tenantId: string
  defaultAmount: number
}

type Stage = "idle" | "pushing" | "waiting" | "completed" | "failed" | "cancelled"

/**
 * Tenant-side M-Pesa pay button. Same flow as the landlord one, but the
 * default phone is empty (tenant enters their own).
 */
export function TenantPayRent({ tenantId, defaultAmount }: Props) {
  const [amount, setAmount] = useState(defaultAmount)
  const [phone, setPhone] = useState("")
  const [stage, setStage] = useState<Stage>("idle")
  const [error, setError] = useState<string | null>(null)
  const [desc, setDesc] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const router = useRouter()

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const startPolling = (checkout: string) => {
    if (pollRef.current) clearInterval(pollRef.current)
    setStage("waiting")
    let attempts = 0
    pollRef.current = setInterval(async () => {
      attempts += 1
      if (attempts > 30) {
        if (pollRef.current) clearInterval(pollRef.current)
        setStage("cancelled")
        setDesc("Timed out waiting for confirmation.")
        return
      }
      try {
        const r = await fetch(`/api/mpesa/status?checkout=${encodeURIComponent(checkout)}`)
        const data = await r.json()
        const s = data?.status
        if (s === "completed") {
          if (pollRef.current) clearInterval(pollRef.current)
          setStage("completed")
          setDesc("Payment received. Your rent balance is updated.")
          router.refresh()
        } else if (s === "failed") {
          if (pollRef.current) clearInterval(pollRef.current)
          setStage("failed")
          setDesc(data.result_desc || "Payment failed. Please try again.")
        } else if (s === "cancelled") {
          if (pollRef.current) clearInterval(pollRef.current)
          setStage("cancelled")
          setDesc(data.result_desc || "Payment was cancelled.")
        }
      } catch { /* ignore */ }
    }, 3000)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setStage("pushing")
    try {
      const r = await apiFetch("/api/mpesa/stkpush", {
        method: "POST",
        body: {
          tenant_id: tenantId,
          amount: Number(amount),
          phone: phone.trim(),
        },
      })
      const checkout = (r as any)?.checkout_request_id
      if (!checkout) throw new Error("No CheckoutRequestID returned.")
      startPolling(checkout)
    } catch (e: any) {
      const text = e instanceof ApiError ? e.message : e?.message || "STK push failed"
      setError(text)
      setStage("failed")
    }
  }

  const reset = () => {
    if (pollRef.current) clearInterval(pollRef.current)
    setStage("idle")
    setError(null)
    setDesc(null)
  }

  if (stage === "completed") {
    return (
      <div className="space-y-3 text-center">
        <CheckCircle2 className="h-8 w-8 mx-auto text-chart-4" />
        <p className="text-sm font-medium text-chart-4">{desc}</p>
        <Button onClick={reset} variant="outline" size="sm">Pay again</Button>
      </div>
    )
  }

  if (stage === "pushing" || stage === "waiting") {
    return (
      <div className="space-y-3 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#4caf50]" />
        <p className="text-sm font-medium">
          {stage === "pushing" ? "Initiating…" : "Check your phone — enter your M-Pesa PIN"}
        </p>
        {stage === "waiting" && (
          <Button variant="ghost" size="sm" onClick={reset}>Cancel</Button>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="t-amount">Amount (KES)</Label>
          <Input
            id="t-amount"
            type="number"
            min={1}
            step="1"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="t-phone">Your M-Pesa number</Label>
          <Input
            id="t-phone"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0712 345 678"
            required
          />
        </div>
      </div>

      {(error || stage === "failed" || stage === "cancelled") && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || desc || "Something went wrong."}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" className="w-full bg-[#4caf50] hover:bg-[#449b48]">
        <Smartphone className="h-4 w-4 mr-2" />
        Pay with M-Pesa
      </Button>
    </form>
  )
}
