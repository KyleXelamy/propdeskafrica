"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, UserPlus, CheckCircle2, AlertCircle, Mail, Clock } from "lucide-react"
import { apiFetch, ApiError } from "@/lib/api/client"

export default function AdminGrantPage() {
  const [email, setEmail] = useState("")
  const [plan, setPlan] = useState("pro")
  const [days, setDays] = useState(30)
  const [reason, setReason] = useState("manual bank transfer")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<{ user: { email: string }; subscription: any } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)
    try {
      const r = await apiFetch("/api/admin/grant-subscription", {
        method: "POST",
        body: { email, plan, days, reason },
      }) as any
      setSuccess({ user: { email }, subscription: r.subscription })
      setEmail("")
    } catch (e: any) {
      const text = e instanceof ApiError ? e.message : e?.message || "Grant failed"
      setError(text)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pt-2 md:pt-0">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
          <UserPlus className="h-6 w-6" />
          Manual Grant
        </h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Activate a subscription for a user who paid via bank transfer,
          in-person card, or any channel outside the app.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Grant subscription</CardTitle>
          <CardDescription className="text-sm">
            The target user must already have signed up at /auth/sign-up. This
            tool activates their subscription and writes an audit event.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">User email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@example.com"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="plan">Plan</Label>
                <Select value={plan} onValueChange={setPlan}>
                  <SelectTrigger id="plan"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solo">Solo (KES 990)</SelectItem>
                    <SelectItem value="pro">Pro (KES 2,490)</SelectItem>
                    <SelectItem value="agency">Agency (KES 7,900)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="days">Days</Label>
                <Input
                  id="days"
                  type="number"
                  min={1}
                  max={3650}
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value) || 30)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reason">Reason</Label>
                <Input
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert className="border-chart-4/30 bg-chart-4/5">
                <CheckCircle2 className="h-4 w-4 text-chart-4" />
                <AlertDescription>
                  Activated {success.user.email} on the {success.subscription.plan_code} plan
                  until {new Date(success.subscription.current_period_end).toLocaleDateString()}.
                </AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Activate subscription
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" /> No subscription? No access.
          </CardTitle>
          <CardDescription className="text-sm">
            Users whose trial has ended or who never paid are redirected to
            /dashboard/billing. They can browse plans and pay via M-Pesa STK
            Push, Paybill, or contact us for an offline invoice.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <Clock className="inline h-3.5 w-3.5 mr-1" />
            New sign-ups get a 14-day trial of the <strong>Pro</strong> plan
            automatically — no code change needed.
          </p>
          <p>
            When a user pays via M-Pesa STK Push from /pricing, their
            subscription is promoted from <code>trialing</code> to{" "}
            <code>active</code> as soon as the STK push confirms.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}