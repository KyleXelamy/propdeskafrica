"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Smartphone, CreditCard, CheckCircle2, ArrowLeft, AlertCircle } from "lucide-react"
import Link from "next/link"

interface Plan {
  code: string
  name: string
  price: number
  cadence: string
}

export default function CheckoutPage() {
  const router = useRouter()
  const search = useSearchParams()
  const planCode = search.get("plan") || "pro"
  const [plan, setPlan] = useState<Plan | null>(null)
  const [phone, setPhone] = useState("")
  const [loading, setLoading] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [stage, setStage] = useState<"idle" | "pushing" | "waiting" | "success" | "failed">("idle")
  const [error, setError] = useState<string | null>(null)
  const [desc, setDesc] = useState<string | null>(null)
  const [pollHandle, setPollHandle] = useState<ReturnType<typeof setInterval> | null>(null)
  const [cardLoading, setCardLoading] = useState(false)

  useEffect(() => {
    fetch("/api/plans").then((r) => r.json()).then((payload) => {
      const plans = Array.isArray(payload) ? payload : payload?.data || []
      const p = plans.find((item: Plan) => item.code === planCode)
      setPlan(p || null)
    }).catch(() => setError("Unable to load subscription plans. Please refresh and try again."))
  }, [planCode])

  useEffect(() => {
    return () => { if (pollHandle) clearInterval(pollHandle) }
  }, [pollHandle])

  const payByCard = async () => {
    setError(null)
    setCardLoading(true)
    try {
      const response = await fetch("/api/subscription/stripe-checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: planCode }),
      })
      const data = await response.json()
      if (!response.ok || !data.url) throw new Error(data.error || "Unable to start card checkout")
      window.location.assign(data.url)
    } catch (e: any) {
      setError(e.message)
      setCardLoading(false)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setPushing(true)
    setStage("pushing")
    try {
      // Use the M-Pesa STK push flow with a metadata note that this is a
      // subscription payment. The library helper accepts arbitrary account
      // reference; we encode the plan code into it.
      const r = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: planCode, phone }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || "Failed to initiate")
      setStage("waiting")
      // poll
      const checkout = data.checkout_request_id
      let attempts = 0
      const h = setInterval(async () => {
        attempts += 1
        if (attempts > 30) {
          clearInterval(h)
          setStage("failed")
          setDesc("Timed out waiting for confirmation.")
          return
        }
        try {
          const sr = await fetch(`/api/subscription/checkout-status?checkout=${encodeURIComponent(checkout)}`)
          const sd = await sr.json()
          if (sd.status === "active" || sd.status === "subscribed") {
            clearInterval(h)
            setStage("success")
            setDesc("Subscription active! Redirecting…")
            setTimeout(() => router.push("/dashboard"), 1500)
          } else if (sd.status === "failed" || sd.status === "canceled") {
            clearInterval(h)
            setStage("failed")
            setDesc(sd.result_desc || "Payment failed.")
          }
        } catch { /* ignore */ }
      }, 3000)
      setPollHandle(h)
    } catch (e: any) {
      setError(e.message)
      setStage("failed")
    } finally {
      setPushing(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 pt-2 md:pt-0">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/billing"><ArrowLeft className="h-4 w-4 mr-1" /> Back to billing</Link>
        </Button>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mt-2">Subscribe to {plan?.name || "PropDesk Africa"}</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Complete your subscription securely. Choose a mobile prompt or card payment below.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Order summary</CardTitle>
          <CardDescription className="text-sm">
            14-day free trial, then {plan?.cadence} billed via M-Pesa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Plan</span>
            <span className="font-medium">{plan?.name || planCode}</span>
          </div>
          <div className="flex justify-between">
            <span>Price</span>
            <span className="font-medium tabular-nums">KES {plan?.price.toLocaleString() || "—"} / month</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Trial</span>
            <span>14 days free</span>
          </div>
        </CardContent>
      </Card>

      {stage === "success" ? (
        <Card className="border-chart-4/30 bg-chart-4/5">
          <CardContent className="pt-6 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 mx-auto text-chart-4" />
            <p className="text-sm font-medium text-chart-4">{desc || "Subscription active"}</p>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      ) : stage === "waiting" || stage === "pushing" ? (
        <Card>
          <CardContent className="pt-6 text-center space-y-3">
            <Loader2 className="h-10 w-10 mx-auto animate-spin text-[#4caf50]" />
            <p className="text-sm font-medium">
              {stage === "pushing" ? "Initiating…" : "Check your phone — enter your M-Pesa PIN"}
            </p>
            {stage === "waiting" && (
              <Button variant="ghost" size="sm" onClick={() => { if (pollHandle) clearInterval(pollHandle); setStage("idle") }}>
                Cancel
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pay with M-Pesa</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="phone">M-Pesa phone number</Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0712 345 678"
                />
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {stage === "failed" && desc && !error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{desc}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full bg-[#4caf50] hover:bg-[#449b48]" disabled={pushing || !plan}>
                <Smartphone className="h-4 w-4 mr-2" />
Pay by mobile prompt
              </Button>
              <p className="text-xs text-muted-foreground text-center">
You&apos;ll receive a secure payment prompt on your phone.
              </p>
              <div className="relative py-1 text-center text-xs text-muted-foreground before:absolute before:left-0 before:right-0 before:top-1/2 before:border-t">
                <span className="relative bg-card px-2">or</span>
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={payByCard} disabled={cardLoading || !plan}>
                {cardLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CreditCard className="h-4 w-4 mr-2" />}
                Pay securely by card
              </Button>
              <p className="text-xs text-muted-foreground text-center">Card payments are processed securely by Stripe.</p>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
