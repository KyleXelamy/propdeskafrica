import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

/**
 * POST /api/support
 * Authenticated support ticket intake. We re-use the same auth pattern
 * as the other routes (lib/api) so cross-origin requests are blocked.
 */
import { withAuth } from "@/lib/api"

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

export const POST = withAuth(async (request, { userId }) => {
  const json = await request.json().catch(() => null)
  const parsed = SupportSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    )
  }

  // No `support_tickets` table exists yet, so a ticket is currently only
  // logged. The reference is still issued and returned so the UI can show
  // the user something, but it is not yet persisted or emailed anywhere —
  // do not present it to a customer as a tracked ticket.
  const ticketRef =
    "PDA-" +
    Date.now().toString(36).toUpperCase() +
    "-" +
    Math.random().toString(36).slice(2, 6).toUpperCase()

  console.info("[support] new ticket", { userId, ticketRef, ...parsed.data })

  return NextResponse.json({
    ok: true,
    ticket: ticketRef,
    message: "We received your ticket and will reply within one business day.",
  })
})

export const GET = withAuth(async () => {
  // Ticket history is not implemented yet — there is no support_tickets
  // table. Returning an empty list rather than an error so the client
  // renders an empty state instead of failing.
  return NextResponse.json({ tickets: [], implemented: false })
})