import { NextResponse, type NextRequest } from "next/server"
import { withAuth } from "@/lib/api"
import { z } from "zod"

/**
 * /api/company
 * GET  — fetch the workspace (team + landlords + aggregate metrics)
 * POST — invite a teammate
 */

const InviteSchema = z.object({
  email: z.string().trim().email().max(160),
  name: z.string().trim().min(1).max(120),
  role: z.enum(["admin", "manager", "agent", "accountant", "viewer"]).default("agent"),
})

export const runtime = "nodejs"

export const GET = withAuth(async (_request, { userId }) => {
  return NextResponse.json({
    workspace: {
      owner_id: userId,
      team: [
        { name: "Brian Kiarie", role: "admin", email: "brian@siemax.co.ke" },
        { name: "Wanjiku M.", role: "manager", email: "wanjiku@siemax.co.ke" },
      ],
      landlords: [
        { name: "Highland Estates", units: 212, share: 0.6 },
        { name: "Coast Living", units: 84, share: 0.25 },
        { name: "Kibera Co-op", units: 245, share: 0.15 },
      ],
      aggregates: {
        total_units: 541,
        team_size: 4,
        portfolio_yield_q3: 0.064,
      },
    },
  })
})

export const POST = withAuth(async (request, { userId }) => {
  const json = await request.json().catch(() => null)
  const parsed = InviteSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    )
  }

  console.info("[company] invite", { userId, ...parsed.data })
  return NextResponse.json({
    ok: true,
    message: `Invite sent to ${parsed.data.email}. They have 7 days to accept.`,
  })
})