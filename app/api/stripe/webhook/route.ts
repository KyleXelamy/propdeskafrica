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

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { error: eventError } = await supabase.from("billing_webhook_events").insert({ provider: "stripe", event_id: event.id, event_type: event.type })
  if (eventError?.code === "23505") return NextResponse.json({ received: true, duplicate: true })
  if (eventError) return NextResponse.json({ error: "Unable to record webhook" }, { status: 503 })

  if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
    const session = event.data.object
    const userId = session.metadata?.user_id
    const paymentId = session.id
    if (userId) {
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
