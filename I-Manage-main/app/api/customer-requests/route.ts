import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { roadmap, type RoadmapItem } from "@/lib/content/marketing"

/**
 * GET  /api/customer-requests            → list all public ideas
 * POST /api/customer-requests            → submit a new idea
 * POST /api/customer-requests?vote=true → upvote an existing idea
 */

const SubmitSchema = z.object({
  title: z.string().trim().min(4).max(160),
  body: z.string().trim().min(8).max(4000),
  email: z.string().trim().email().max(160).optional().or(z.literal("")),
})

const VoteSchema = z.object({
  slug: z.string().min(1),
})

export const runtime = "nodejs"

export async function GET() {
  return NextResponse.json({
    count: roadmap.length,
    items: roadmap.map((r) => ({
      slug: r.slug,
      title: r.title,
      description: r.description,
      status: r.status,
      category: r.category,
      votes: r.votes,
    })),
  })
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get("action")

  try {
    const json = await request.json().catch(() => null)

    if (action === "vote") {
      const parsed = VoteSchema.safeParse(json)
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid vote payload" }, { status: 400 })
      }
      const item: RoadmapItem | undefined = roadmap.find((r) => r.slug === parsed.data.slug)
      if (!item) return NextResponse.json({ error: "Idea not found" }, { status: 404 })
      // In-memory: not persisted. In production this writes to a `customer_requests` table
      // with one vote per user per idea (deduped by user id / cookie).
      return NextResponse.json({ ok: true, slug: parsed.data.slug, votes: item.votes + 1 })
    }

    const parsed = SubmitSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 })
    }
    const ref = "REQ-" + Date.now().toString(36).toUpperCase()
    console.info("[customer-requests] new idea", { ref, ...parsed.data })
    return NextResponse.json({ ok: true, reference: ref })
  } catch (err) {
    console.error("[api/customer-requests] failed", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}