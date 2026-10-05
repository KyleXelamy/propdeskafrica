import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

/**
 * POST /api/feedback
 * Public endpoint for the customer-requests page.
 */
const Schema = z.object({
  title: z.string().trim().min(4).max(160),
  body: z.string().trim().min(8).max(4000),
  email: z.string().trim().email().max(160).optional().or(z.literal("")),
})

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const json = await request.json().catch(() => null)
    const parsed = Schema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 })
    }

    const ref = "FB-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase()
    console.info("[feedback] new idea", { ref, ...parsed.data })
    return NextResponse.json({ ok: true, reference: ref, message: "Idea received. We'll review it within 5 business days." })
  } catch (err) {
    console.error("[api/feedback] failed", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
}