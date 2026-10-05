import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

/**
 * POST /api/pricing/lead
 * Public endpoint used by the pricing page CTA when a user wants to
 * book a call for the Agency plan.
 */
const LeadSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(160),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  portfolio_size: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
})

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const json = await request.json().catch(() => null)
    const parsed = LeadSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      )
    }

    console.info("[pricing/lead] new lead", parsed.data)

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