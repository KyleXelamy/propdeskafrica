import { withAuth, errorResponse, HttpError, successResponse } from "@/lib/api"
import { getStripe } from "@/lib/stripe"
import { createClient } from "@supabase/supabase-js"

export const POST = withAuth(async (req, { supabase, userId }) => {
  const body = await req.json().catch(() => ({})) as { plan?: string }
  if (body.plan !== "pro") throw new HttpError("PropDesk Africa currently has one subscription plan", 400)

  const { data: planRow, error } = await supabase
    .from("plans")
    .select("code, name, price_kes")
    .eq("code", "pro")
    .single()
  if (error || !planRow) throw new HttpError("Plan not found", 404)

  const stripe = getStripe()
  const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const admin = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    : supabase
  const { data: authUser } = await supabase.auth.getUser()

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{
      price_data: {
        currency: "kes",
        product_data: { name: planRow.name, description: "PropDesk Africa monthly subscription" },
        unit_amount: Number(planRow.price_kes) * 100,
      },
      quantity: 1,
    }],
    customer_email: authUser.user?.email || undefined,
    success_url: `${origin}/dashboard/billing?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/dashboard/billing/checkout?plan=pro&payment=canceled`,
    metadata: { user_id: userId, plan_code: "pro" },
  })

  const { error: insertError } = await admin.from("subscription_payments").insert({
    user_id: userId,
    plan_code: "pro",
    amount: Number(planRow.price_kes),
    phone: "stripe",
    status: "initiated",
    stripe_session_id: session.id,
  })
  if (insertError) return errorResponse(`Unable to record payment: ${insertError.message}`, 500)

  return successResponse({ url: session.url })
})
