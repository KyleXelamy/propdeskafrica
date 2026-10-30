import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { checkRateLimit, clientIdentifier } from "@/lib/api/rate-limit"
import { insertSubmission, reference, SubmissionStoreError } from "@/lib/api/public-submissions"

/**
 * POST /api/feedback
 * Public endpoint for the customer-requests page.
 *
 * The idea is now stored in `customer_requests` and counted from the database.
 * It used to be logged and then forgotten, while the UI told the visitor
 * "We'll review it within 5 business days".
 */
const Schema = z.object({
  title: z.string().trim().min(4).max(160),
  body: z.string().trim().min(8).max(4000),
  email: z.string().trim().email().max(160).optional().or(z.literal("")),
})

export const runtime = "nodejs"

const RATE_LIMIT = 5
const RATE_WINDOW_MS = 60_000

/** Slug for a submitted idea — unique, readable, and derived from the title. */
function slugify(title: string, ref: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
  return base ? `${base}-${ref.slice(-6).toLowerCase()}` : `idea-${ref.slice(-6).toLowerCase()}`
}

export async function POST(request: NextRequest) {
  const ip = clientIdentifier(request)
  const limit = checkRateLimit(`feedback:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.resetInSeconds) } },
    )
  }

  try {
    const json = await request.json().catch(() => null)
    const parsed = Schema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 })
    }

    const ref = reference("REQ")
    const slug = slugify(parsed.data.title, ref)

    try {
      await insertSubmission("customer_requests", {
        slug,
        title: parsed.data.title,
        body: parsed.data.body,
        email: parsed.data.email || null,
        reference: ref,
        votes: 0,
      })
    } catch (err) {
      console.error("[api/feedback] store failed", err)
      return NextResponse.json(
        { error: "We could not save your idea right now. Please try again shortly." },
        { status: 503 },
      )
    }

    // Log the fact, not the free-text body. Free-text submissions are PII.
    console.info("[feedback] idea stored", { ref, slug })

    return NextResponse.json({
      ok: true,
      reference: ref,
      message: "Idea received. We'll review it within 5 business days.",
    })
  } catch (err) {
    console.error("[api/feedback] failed", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
}
