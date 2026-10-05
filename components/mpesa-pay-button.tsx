"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Smartphone, CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import { apiFetch, ApiError } from "@/lib/api/client"

interface Props {
  tenantId: string
  paymentId?: string
  defaultAmount: number
  defaultPhone?: string
}

type Stage = "idle" | "pushing" | "waiting" | "completed" | "failed" | "cancelled"

/**
 * Full M-Pesa STK Push flow:
 *  1. User clicks "Pay with M-Pesa" → POST /api/mpesa/stkpush
 *  2. We show the prompt and start polling /api/mpesa/status every 3s
 *  3. When status flips to "completed" or "failed", we stop polling
 *
 * Drop this into the tenant detail page or the finances tab.
 */
export function MpesaPayButton({ tenantId, paymentId, defaultAmount, defaultPhone }: Props) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(defaultAmount)
  const [phone, setPhone] = useState(defaultPhone || "")
  const [stage, setStage] = useState<Stage>("idle")
  const [error, setError] = useState<string | null>(null)
  const [desc, setDesc] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const router = useRouter()

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const startPolling = (checkout: string) => {
    if (pollRef.current) clearInterval(pollRef.current)
    setStage("waiting")
    let attempts = 0
    pollRef.current = setInterval(async () => {
      attempts += 1
      // ~90 seconds total before giving up (the M-Pesa prompt itself times out at 60s)
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
          setDesc("Payment received. Thank you!")
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
      } catch {
        // ignore network blips during polling
      }
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
          payment_id: paymentId || undefined,
          amount: Number(amount),
          phone: phone.trim(),
        },
      })
      const checkout = (r as any)?.checkout_request_id
      if (!checkout) {
        throw new Error("No CheckoutRequestID returned. Check M-Pesa credentials.")
      }
      startPolling(checkout)
    } catch (e: any) {
      const text = e instanceof ApiError ? e.message : e?.message || "STK push failed"
      setError(text)
      setStage("failed")
    }
  }

  const cancel = () => {
    if (pollRef.current) clearInterval(pollRef.current)
    setStage("cancelled")
  }

  const reset = () => {
    if (pollRef.current) clearInterval(pollRef.current)
    setStage("idle")
    setError(null)
    setDesc(null)
  }

  return (
    <div>
      {!open ? (
        <Button onClick={() => setOpen(true)} variant="default" className="bg-[#4caf50] hover:bg-[#449b48]">
          <Smartphone className="h-4 w-4 mr-2" />
          Pay with M-Pesa
        </Button>
      ) : (
        <div className="border rounded-lg p-4 space-y-4 bg-card">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              M-Pesa STK Push
            </h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => { reset(); setOpen(false) }}
              disabled={stage === "pushing" || stage === "waiting"}
            >
              Close
            </Button>
          </div>

          {stage === "idle" || stage === "failed" || stage === "cancelled" ? (
            <form onSubmit={submit} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="mpesa-amount">Amount (KES)</Label>
                  <Input
                    id="mpesa-amount"
                    type="number"
                    min={1}
                    step="1"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mpesa-phone">Phone number</Label>
                  <Input
                    id="mpesa-phone"
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
                Send to phone
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                You&apos;ll receive an M-Pesa prompt on your phone to enter your PIN.
              </p>
            </form>
          ) : stage === "pushing" ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2 text-sm">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p>Initiating STK push…</p>
            </div>
          ) : stage === "waiting" ? (
            <div className="space-y-3 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#4caf50]" />
              <p className="text-sm font-medium">Check your phone</p>
              <p className="text-xs text-muted-foreground">
                Enter your M-Pesa PIN to authorize the payment. We&apos;ll
                detect it automatically.
              </p>
              <Button variant="ghost" size="sm" onClick={cancel}>
                Cancel
              </Button>
            </div>
          ) : stage === "completed" ? (
            <div className="space-y-3 text-center">
              <CheckCircle2 className="h-8 w-8 mx-auto text-chart-4" />
              <p className="text-sm font-medium text-chart-4">{desc || "Payment received"}</p>
              <Button onClick={reset} variant="outline" size="sm">Make another payment</Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
