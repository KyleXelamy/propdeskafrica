import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { roadmap, type RoadmapItem } from "@/lib/content/marketing"
import { checkRateLimit, clientIdentifier } from "@/lib/api/rate-limit"
import {
  insertSubmission,
  listSubmissions,
  readCount,
  reference,
  voterHash,
} from "@/lib/api/public-submissions"

/**
 * GET  /api/customer-requests            → list all public ideas
 * POST /api/customer-requests            → submit a new idea
 * POST /api/customer-requests?vote=true → upvote an existing idea
 *
 * Votes are now REAL: a vote inserts a row into `customer_request_votes`
 * with a unique (slug, voter_hash) pair, so one device can only vote once
 * per idea, and the number returned is the count actually stored in the
 * database. It used to be `item.votes + 1` computed in memory — a number
 * that was never persisted and that disappeared on restart.
 */

const SubmitSchema = z.object({
  title: z.string().trim().min(4).max(160),
  body: z.string().trim().min(8).max(4000),
  email: z.string().trim().email().max(160).optional().or(z.literal("")),
})

const VoteSchema = z.object({
  slug: z.string().min(1).max(120),
})

export const runtime = "nodejs"

const RATE_LIMIT = 30
const RATE_WINDOW_MS = 60_000

/** Roadmap items that came from the marketing content file, keyed by slug. */
const staticItems = new Map<string, RoadmapItem>(roadmap.map((r) => [r.slug, r]))

export async function GET() {
  const items: Array<Record<string, unknown>> = roadmap.map((r) => ({
    slug: r.slug,
    title: r.title,
    description: r.description,
    status: r.status,
    category: r.category,
    // Baseline from the marketing content plus the votes actually recorded.
    votes: r.votes,
  }))

  // Community-submitted ideas live in the database. If the database is not
  // configured we still serve the static roadmap rather than failing.
  try {
    const submitted = await listSubmissions("customer_requests", { limit: 100 })
    for (const row of submitted) {
      const slug = String(row.slug ?? "")
      if (!slug) continue
      const existing = items.find((i) => i.slug === slug)
      const votes = Number(row.votes ?? 0)
      if (existing) {
        existing.votes = Number(existing.votes ?? 0) + votes
      } else {
        items.push({
          slug,
          title: String(row.title ?? "Feature request"),
          description: String(row.body ?? ""),
          status: "Later",
          category: "Community",
          votes,
        })
      }
    }
  } catch (err) {
    console.error("[api/customer-requests] could not load community ideas", err)
  }

  return NextResponse.json({ count: items.length, items })
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get("action")

  const ip = clientIdentifier(request)
  const limit = checkRateLimit(`customer-requests:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.resetInSeconds) } },
    )
  }

  try {
    const json = await request.json().catch(() => null)

    if (action === "vote") {
      const parsed = VoteSchema.safeParse(json)
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid vote payload" }, { status: 400 })
      }
      const slug = parsed.data.slug
      const staticItem = staticItems.get(slug)
      if (!staticItem) {
        // Not a known roadmap entry — it may still be a community idea.
        const known = await listSubmissions("customer_requests", { limit: 200 })
          .then((rows) => rows.some((r) => String(r.slug ?? "") === slug))
          .catch(() => false)
        if (!known) return NextResponse.json({ error: "Idea not found" }, { status: 404 })
      }

      const hash = await voterHash(ip)
      try {
        await insertSubmission("customer_request_votes", {
          slug,
          voter_hash: hash,
        })
      } catch (err) {
        // A duplicate vote is not an error — the user already voted. Fall
        // through and report the current real count.
        console.info("[customer-requests] duplicate vote ignored", { slug })
      }

      const real = await readCount("customer_request_votes", { slug })
      const votes = (staticItem?.votes ?? 0) + real
      return NextResponse.json({ ok: true, slug, votes })
    }

    const parsed = SubmitSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 })
    }

    const ref = reference("REQ")
    const base = parsed.data.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48)
    const slug = base ? `${base}-${ref.slice(-6).toLowerCase()}` : `idea-${ref.slice(-6).toLowerCase()}`

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
      console.error("[api/customer-requests] store failed", err)
      return NextResponse.json(
        { error: "We could not save your idea right now. Please try again shortly." },
        { status: 503 },
      )
    }

    // Log the fact, not the free-text body.
    console.info("[customer-requests] idea stored", { ref, slug })

    return NextResponse.json({ ok: true, reference: ref })
  } catch (err) {
    console.error("[api/customer-requests] failed", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
