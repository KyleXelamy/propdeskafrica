import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2, Sparkles, AlertTriangle, Smartphone, ArrowRight } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

interface Plan {
  code: string
  name: string
  tagline: string
  price: number
  cadence: string
  max_properties: number | null
  max_tenants: number | null
  features: string[]
  cta: string
  highlight: boolean
}

async function getSubscriptionState() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  // Try the RPC; fall back to direct read
  let status: any = null
  try {
    const { data } = await supabase.rpc("subscription_status" as any, { p_user: user.id } as any)
    status = Array.isArray(data) ? data[0] : data
  } catch { /* RPC not installed */ }
  if (!status) {
    const { data } = await supabase
      .from("subscriptions")
      .select("*, plans(name, code)")
      .eq("user_id", user.id)
      .maybeSingle()
    if (data) {
      const trialExpired = data.status === "trialing" && data.trial_ends_at && new Date(data.trial_ends_at) < new Date()
      status = {
        is_active: !trialExpired && !["canceled","expired","past_due"].includes(data.status),
        is_trialing: data.status === "trialing",
        trial_expired: trialExpired,
        days_left: data.current_period_end
          ? Math.max(0, Math.ceil((new Date(data.current_period_end).getTime() - Date.now()) / 86400000))
          : 0,
        plan: data.plan_code,
        plan_name: (data as any).plans?.name || data.plan_code,
        reason: trialExpired ? "trial_ended" : data.status,
      }
    }
  }
  return { user, status }
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>
}) {
  const { reason } = await searchParams
  const { user, status } = await getSubscriptionState()
  const isTrialing = status?.is_trialing
  const isExpired = !status?.is_active
  const daysLeft = status?.days_left || 0

  // Fetch plans from /api/plans (server-side fetch)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const plans: Plan[] = await fetch(`${baseUrl}/api/plans`).then(r => r.json()).catch(() => [])

  return (
    <div className="space-y-6 pt-2 md:pt-0">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Billing</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Manage your subscription and payment methods.
        </p>
      </div>

      {isExpired && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Your access is paused.</strong>{" "}
            {reason === "trial_ended"
              ? "Your 14-day trial has ended. Pick a plan to keep using I-Manage."
              : reason === "canceled" || reason === "expired"
                ? "Your subscription has ended. Pick a plan to resume."
                : "Pick a plan below to continue."}
          </AlertDescription>
        </Alert>
      )}

      {isTrialing && !isExpired && (
        <Alert className="border-primary/30 bg-primary/5">
          <Sparkles className="h-4 w-4 text-primary" />
          <AlertDescription>
            <strong>You&apos;re on a {daysLeft}-day trial</strong> of the{" "}
            <span className="font-medium">{status?.plan_name || "Pro"}</span> plan.{" "}
            Pick a plan below to keep access after day 14.
          </AlertDescription>
        </Alert>
      )}

      {/* Current plan card */}
      {status?.is_active && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Current plan</span>
              <Badge className="bg-chart-4 text-white">{status.plan_name || status.plan}</Badge>
            </CardTitle>
            <CardDescription>
              {isTrialing
                ? `Trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`
                : `Renews in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Logged in as <span className="font-medium text-foreground">{user.email}</span>.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="#plans">
                  Change plan <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
              {!isTrialing && (
                <form action="/api/subscription" method="post">
                  {/* Using fetch wrapper would need JS — just link to a confirm */}
                </form>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plans */}
      <div id="plans" className="space-y-3 pt-4">
        <h2 className="text-xl font-semibold">Pick a plan</h2>
        <p className="text-sm text-muted-foreground">
          Pay with M-Pesa STK Push, Paybill, or get in touch for a manual invoice.
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((p) => {
            const isCurrent = p.code === status?.plan && status?.is_active
            return (
              <Card key={p.code} className={p.highlight ? "border-primary ring-1 ring-primary/20" : ""}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{p.name}</CardTitle>
                    {p.highlight && <Badge className="bg-primary text-primary-foreground">Popular</Badge>}
                  </div>
                  <CardDescription className="text-sm">{p.tagline}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <span className="text-3xl font-bold tabular-nums">
                      KES {p.price.toLocaleString()}
                    </span>
                    <span className="text-muted-foreground text-sm"> / {p.cadence.replace("KES / ", "")}</span>
                  </div>

                  <ul className="space-y-2 text-sm">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-chart-4 mt-0.5 flex-shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="pt-2 space-y-2">
                    <Button
                      asChild={!isCurrent}
                      className="w-full"
                      variant={p.highlight ? "default" : "outline"}
                      disabled={isCurrent}
                    >
                      {isCurrent ? (
                        <span>Current plan</span>
                      ) : (
                        <Link href={`/dashboard/billing/checkout?plan=${p.code}`}>
                          <Smartphone className="h-4 w-4 mr-2" />
                          {p.cta}
                        </Link>
                      )}
                    </Button>
                    {!isCurrent && (
                      <p className="text-[10px] text-muted-foreground text-center">
                        14-day free trial · cancel anytime
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Manual / offline payment card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Paying from a different channel?</CardTitle>
          <CardDescription className="text-sm">
            We also accept bank transfer, cheque, and in-person card. After
            you pay, we&apos;ll activate your account manually within a few
            hours.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="font-medium">Paybill:</span> 247247 &middot;{" "}
            <span className="font-medium">Account:</span> 0758034649
          </p>
          <p className="text-xs text-muted-foreground">
            Or get in touch:{" "}
            <a href="mailto:billing@imanage.co.ke" className="underline hover:text-primary">
              billing@imanage.co.ke
            </a>{" "}
            · +254 700 000 000
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
