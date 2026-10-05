import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

/**
 * POST /api/contact
 * Public endpoint used by /contact page form.
 * In production this writes to a `contact_submissions` Supabase table and
 * fires a notification email. For now it validates and acks.
 */
const ContactSchema = z.object({
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(160),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  topic: z.enum(["sales", "demo", "support", "partnership", "other"]),
  message: z.string().trim().min(8).max(4000),
  // Honeypot — bots fill this; humans never see it.
  company_website: z.string().max(0).optional(),
})

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const json = await request.json().catch(() => null)
    const parsed = ContactSchema.safeParse(json)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return NextResponse.json(
        { error: first?.message ?? "Invalid input", issues: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { company_website, ...payload } = parsed.data
    if (company_website && company_website.length > 0) {
      // Honeypot triggered — pretend success but do nothing.
      return NextResponse.json({ ok: true })
    }

    // Stub: in production persist to Supabase + send email via Resend.
    console.info("[contact] new message", {
      email: payload.email,
      topic: payload.topic,
      name: `${payload.first_name} ${payload.last_name}`,
    })

    const subject = `[I-Manage] ${payload.topic} — ${payload.first_name} ${payload.last_name}`
    const emailBody = [
      `Name: ${payload.first_name} ${payload.last_name}`,
      `Email: ${payload.email}`,
      `Company / portfolio: ${payload.company || "Not provided"}`,
      `Topic: ${payload.topic}`,
      "",
      "Message:",
      payload.message,
    ].join("\n")
    const mailto = `mailto:bknglabs.dev@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`

    return NextResponse.json({
      ok: true,
      mailto,
      message: "Your email app is ready with the request filled in. Press Send to contact the I-Manage team.",
    })
  } catch (err) {
    console.error("[api/contact] failed", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
}
