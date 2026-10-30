import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { checkRateLimit, clientIdentifier } from "@/lib/api/rate-limit"
import { insertSubmission, reference, SubmissionStoreError } from "@/lib/api/public-submissions"

/**
 * POST /api/pricing/lead
 * Public endpoint used by the pricing page CTA when a user wants to
 * book a call for the Agency plan.
 *
 * The lead is now STORED in `contact_submissions` with kind='pricing_lead'.
 * It used to be logged and dropped.
 */
const LeadSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(160),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  portfolio_size: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
})

export const runtime = "nodejs"

const RATE_LIMIT = 5
const RATE_WINDOW_MS = 60_000

export async function POST(request: NextRequest) {
  const ip = clientIdentifier(request)
  const limit = checkRateLimit(`pricing-lead:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.resetInSeconds) } },
    )
  }

  try {
    const json = await request.json().catch(() => null)
    const parsed = LeadSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      )
    }

    const [firstName, ...rest] = parsed.data.name.split(/\s+/)
    const ref = reference("LEAD")

    try {
      await insertSubmission("contact_submissions", {
        kind: "pricing_lead",
        first_name: firstName ?? parsed.data.name,
        last_name: rest.join(" ") || null,
        email: parsed.data.email.toLowerCase(),
        company: parsed.data.company || null,
        topic: "sales",
        message: [
          `Portfolio size: ${parsed.data.portfolio_size || "not provided"}`,
          parsed.data.notes ? `Notes: ${parsed.data.notes}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        reference: ref,
      })
    } catch (err) {
      console.error("[api/pricing/lead] store failed", err)
      return NextResponse.json(
        { error: "We could not record your request right now. Please try again shortly." },
        { status: 503 },
      )
    }

    // Log the fact, not the lead's personal details.
    console.info("[pricing/lead] lead stored", { ref, portfolio_size: parsed.data.portfolio_size ?? null })

    return NextResponse.json({
      ok: true,
      message: "We'll reach out within one business day to schedule a call.",
    })
  } catch (err) {
    console.error("[api/pricing/lead] failed", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
}
