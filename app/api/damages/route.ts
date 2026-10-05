import { NextResponse, type NextRequest } from "next/server"
import { withAuth } from "@/lib/api"
import { z } from "zod"

/**
 * /api/damages
 * GET  — list damage records
 * POST — log a new damage with photos
 */

const Severity = z.enum(["low", "medium", "high"])

const CreateSchema = z.object({
  title: z.string().trim().min(4).max(160),
  property_id: z.string().uuid(),
  unit_id: z.string().uuid().optional(),
  tenant_id: z.string().uuid().optional(),
  location: z.string().trim().max(200),
  severity: Severity,
  description: z.string().trim().max(4000).optional(),
  estimated_cost: z.number().int().nonnegative().optional(),
  photos: z.array(z.string().url()).max(20).optional(),
})

export const runtime = "nodejs"

export const GET = withAuth(async () => {
  const stub = [
    {
      id: "DMG-204",
      title: "Cracked bathroom tile — shower floor",
      property: "Karen House 1",
      severity: "medium",
      status: "in_repair",
      reported_at: "2026-09-12T08:00:00Z",
      cost: 4500,
    },
  ]
  return NextResponse.json({ count: stub.length, damages: stub })
})

export const POST = withAuth(async (request, { userId }) => {
  const json = await request.json().catch(() => null)
  const parsed = CreateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    )
  }

  const ref = "DMG-" + Date.now().toString(36).toUpperCase().slice(-6)
  console.info("[damages] new record", { userId, ref, ...parsed.data })
  return NextResponse.json({ ok: true, reference: ref })
})

void Severity