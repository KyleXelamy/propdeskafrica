import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { checkRateLimit, clientIdentifier } from "@/lib/api/rate-limit"
import { insertSubmission, reference } from "@/lib/api/public-submissions"

/**
 * POST /api/enterprise/lead
 * Public endpoint for Enterprise sales leads. Separate from /api/pricing/lead
 * so we can route to the enterprise inbox.
 *
 * The lead is now STORED in `contact_submissions` with kind='enterprise_lead'.
 * It used to be logged and dropped.
 */
const Schema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(160),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  units: z.string().trim().max(40).optional(),
  region: z.string().trim().max(80).optional(),
  timeline: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(4000).optional().or(z.literal("")),
})

export const runtime = "nodejs"

const RATE_LIMIT = 5
const RATE_WINDOW_MS = 60_000

export async function POST(request: NextRequest) {
  const ip = clientIdentifier(request)
  const limit = checkRateLimit(`enterprise-lead:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.resetInSeconds) } },
    )
  }

  try {
    const json = await request.json().catch(() => null)
    const parsed = Schema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 })
    }

    const [firstName, ...rest] = parsed.data.name.split(/\s+/)
    const ref = reference("ENT")

    try {
      await insertSubmission("contact_submissions", {
        kind: "enterprise_lead",
        first_name: firstName ?? parsed.data.name,
        last_name: rest.join(" ") || null,
        email: parsed.data.email.toLowerCase(),
        company: parsed.data.company || null,
        topic: "sales",
        message: [
          `Units: ${parsed.data.units || "not provided"}`,
          `Region: ${parsed.data.region || "not provided"}`,
          `Timeline: ${parsed.data.timeline || "not provided"}`,
          parsed.data.notes ? `Notes: ${parsed.data.notes}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        reference: ref,
      })
    } catch (err) {
      console.error("[api/enterprise/lead] store failed", err)
      return NextResponse.json(
        { error: "We could not record your request right now. Please try again shortly." },
        { status: 503 },
      )
    }

    // Log the fact, not the lead's personal details.
    console.info("[enterprise/lead] lead stored", { ref })

    return NextResponse.json({ ok: true, message: "Enterprise team will reach out within one business day." })
  } catch (err) {
    console.error("[api/enterprise/lead] failed", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
}
