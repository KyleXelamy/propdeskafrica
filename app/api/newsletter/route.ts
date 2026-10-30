import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { checkRateLimit, clientIdentifier } from "@/lib/api/rate-limit"
import { insertSubmission, SubmissionStoreError } from "@/lib/api/public-submissions"

/**
 * POST /api/newsletter
 * Public endpoint. Subscribes an email to the PropDesk Africa newsletter.
 *
 * The submission is now actually STORED in `newsletter_subscribers`. It used
 * to be `console.info`-ed and nothing else, while still telling the visitor
 * "Check your inbox for a confirmation" — a success message for something
 * that never happened.
 */
const NewsletterSchema = z.object({
  email: z.string().trim().email().max(160),
  source: z.string().trim().max(40).optional(),
})

export const runtime = "nodejs"

const RATE_LIMIT = 5
const RATE_WINDOW_MS = 60_000

export async function POST(request: NextRequest) {
  const ip = clientIdentifier(request)
  const limit = checkRateLimit(`newsletter:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many subscription attempts. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.resetInSeconds) } },
    )
  }

  try {
    const json = await request.json().catch(() => null)
    const parsed = NewsletterSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 })
    }

    const email = parsed.data.email.toLowerCase()

    try {
      await insertSubmission(
        "newsletter_subscribers",
        {
          email,
          source: parsed.data.source ?? null,
          referrer: request.headers.get("referer") ?? null,
          user_agent: (request.headers.get("user-agent") ?? "").slice(0, 300) || null,
        },
        { ignoreConflict: true },
      )
    } catch (err) {
      if (err instanceof SubmissionStoreError && !err.retryable) throw err
      // The subscriber table may not exist yet on a database that has not run
      // db/migrations/004-marketing-forms.sql. Say so honestly instead of
      // pretending the subscription worked.
      console.error("[api/newsletter] store failed", err)
      return NextResponse.json(
        { error: "Subscriptions are temporarily unavailable. Please try again shortly." },
        { status: 503 },
      )
    }

    // Log the fact, not the address. Email addresses are personal data.
    console.info("[newsletter] subscribed", { source: parsed.data.source ?? null })

    return NextResponse.json({
      ok: true,
      message: "You're on the list. Thanks for subscribing.",
    })
  } catch (err) {
    console.error("[api/newsletter] failed", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
}
