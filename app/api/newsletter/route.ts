import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

/**
 * POST /api/newsletter
 * Public endpoint. Subscribes an email to the I-Manage newsletter.
 * Stub: in production we push to a Supabase `newsletter_subscribers` table
 * and trigger a confirmation via Resend.
 */
const NewsletterSchema = z.object({
  email: z.string().trim().email().max(160),
  source: z.string().trim().max(40).optional(),
})

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const json = await request.json().catch(() => null)
    const parsed = NewsletterSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 })
    }

    console.info("[newsletter] subscribe", parsed.data)

    return NextResponse.json({
      ok: true,
      message: "Check your inbox for a confirmation.",
    })
  } catch (err) {
    console.error("[api/newsletter] failed", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
}