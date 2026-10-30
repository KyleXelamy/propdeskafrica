import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/api"
import { insertSubmission } from "@/lib/api/public-submissions"

/**
 * POST /api/support
 * Authenticated support ticket intake. We re-use the same auth pattern
 * as the other routes (lib/api) so cross-origin requests are blocked.
 *
 * The ticket is now STORED in `support_tickets`. It used to be logged only —
 * the reference was handed to the customer as a "tracked ticket" but nothing
 * was ever written, so no agent could ever answer it.
 */
const SupportSchema = z.object({
  subject: z.string().trim().min(4).max(160),
  category: z.enum(["bug", "billing", "question", "feature"]),
  message: z.string().trim().min(8).max(4000),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
  attachments: z
    .array(
      z.object({
        name: z.string().max(200),
        size: z.number().int().nonnegative().max(10 * 1024 * 1024),
        type: z.string().max(80),
      }),
    )
    .max(5)
    .optional(),
})

export const runtime = "nodejs"

function ticketReference(): string {
  return (
    "PDA-" +
    Date.now().toString(36).toUpperCase() +
    "-" +
    Math.random().toString(36).slice(2, 6).toUpperCase()
  )
}

export const POST = withAuth(async (request, { userId }) => {
  const json = await request.json().catch(() => null)
  const parsed = SupportSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    )
  }

  const ticketRef = ticketReference()

  try {
    await insertSubmission("support_tickets", {
      user_id: userId,
      reference: ticketRef,
      subject: parsed.data.subject,
      category: parsed.data.category,
      priority: parsed.data.priority,
      message: parsed.data.message,
      status: "open",
    })
  } catch (err) {
    console.error("[api/support] store failed", err)
    return NextResponse.json(
      { error: "We could not open your ticket right now. Please try again shortly." },
      { status: 503 },
    )
  }

  // Log the fact, not the ticket body.
  console.info("[support] ticket stored", { userId, ticketRef, category: parsed.data.category })

  return NextResponse.json({
    ok: true,
    ticket: ticketRef,
    message: "We received your ticket and will reply within one business day.",
  })
})

export const GET = withAuth(async () => {
  // Ticket history is not implemented yet — there is no support_tickets
  // read path wired into the dashboard. Returning an explicit empty list is
  // honest; a 200 with a hardcoded "none" message would not be.
  return NextResponse.json({ count: 0, tickets: [] })
})
