import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { checkRateLimit, clientIdentifier } from "@/lib/api/rate-limit"
import { insertSubmission, reference } from "@/lib/api/public-submissions"

/**
 * POST /api/contact
 * Public endpoint used by the /contact page form.
 *
 * The submission is now STORED in `contact_submissions` AND the visitor still
 * gets a prefilled mailto so they can send it from their own mail client.
 * It used to only build the mailto — nothing was recorded on the server, so
 * a visitor who never pressed Send left no trace at all.
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

const RATE_LIMIT = 5
const RATE_WINDOW_MS = 60_000

export async function POST(request: NextRequest) {
  const ip = clientIdentifier(request)
  const limit = checkRateLimit(`contact:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many messages sent. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.resetInSeconds) } },
    )
  }

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

    const ref = reference("MSG")
    try {
      await insertSubmission("contact_submissions", {
        kind: "contact",
        first_name: payload.first_name,
        last_name: payload.last_name,
        email: payload.email.toLowerCase(),
        company: payload.company || null,
        topic: payload.topic,
        message: payload.message,
        reference: ref,
      })
    } catch (err) {
      console.error("[api/contact] store failed", err)
      return NextResponse.json(
        { error: "We could not record your message right now. Please try again shortly." },
        { status: 503 },
      )
    }

    // Log the fact, not the message body. Free-text contact messages are PII.
    console.info("[contact] message stored", { ref, topic: payload.topic })

    const subject = `[PropDesk Africa] ${payload.topic} — ${payload.first_name} ${payload.last_name}`
    const emailBody = [
      `Name: ${payload.first_name} ${payload.last_name}`,
      `Email: ${payload.email}`,
      `Company / portfolio: ${payload.company || "Not provided"}`,
      `Topic: ${payload.topic}`,
      `Reference: ${ref}`,
      "",
      "Message:",
      payload.message,
    ].join("\n")
    const mailto = `mailto:bknglabs.dev@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`

    return NextResponse.json({
      ok: true,
      mailto,
      message: "Your email app is ready with the request filled in. Press Send to contact the PropDesk Africa team.",
    })
  } catch (err) {
    console.error("[api/contact] failed", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
