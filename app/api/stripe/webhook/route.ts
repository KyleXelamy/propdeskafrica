import { NextRequest, NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe"
import { createClient } from "@supabase/supabase-js"

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature")
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!signature || !secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 400 })

  const payload = await req.text()
  let event
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret)
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object
    const userId = session.metadata?.user_id
    const paymentId = session.id
    if (userId) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (!url || !serviceKey) return NextResponse.json({ error: "Database not configured" }, { status: 503 })
      const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })
      await supabase.from("subscription_payments").update({
        status: "active",
        stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
        completed_at: new Date().toISOString(),
        result_desc: "Stripe checkout completed",
      }).eq("stripe_session_id", paymentId).eq("user_id", userId)
      await supabase.from("subscriptions").update({
        status: "active",
        plan_code: "pro",
        current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
      }).eq("user_id", userId)
    }
  }

  return NextResponse.json({ received: true })
}
