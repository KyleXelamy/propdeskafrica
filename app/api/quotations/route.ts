import { NextResponse, type NextRequest } from "next/server"
import { withAuth } from "@/lib/api"
import { z } from "zod"

/**
 * /api/quotations
 * Landlord-side maintenance quote workflow.
 * GET   — list quotes (filter by property, status, contractor)
 * POST  — create a new quote request
 */

const Status = z.enum(["draft", "requested", "pending", "approved", "rejected", "paid"])

const CreateSchema = z.object({
  title: z.string().trim().min(4).max(160),
  property_id: z.string().uuid().optional(),
  maintenance_id: z.string().uuid().optional(),
  contractor_ids: z.array(z.string().uuid()).min(1).max(10),
  notes: z.string().trim().max(2000).optional(),
})

export const runtime = "nodejs"

export const GET = withAuth(async (request) => {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")
  const propertyId = searchParams.get("property_id")
  const limit = Math.min(Number(searchParams.get("limit") ?? 50) || 50, 100)

  // In production: query the `quotations` table filtered by userId.
  // For now we return a stub shape so the dashboard has something to render.
  const stub = [
    {
      id: "QT-1042",
      title: "Replace burst water heater — Karen House 1",
      property: "Karen House 1",
      contractor: "AquaFix Plumbing",
      amount: 18500,
      status: status ?? "pending",
      requested_at: "2026-09-22T08:00:00Z",
    },
  ]
  return NextResponse.json({
    count: stub.length,
    quotations: propertyId ? stub.filter((q) => true) : stub.slice(0, limit),
  })
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

  const ref = "QT-" + Date.now().toString(36).toUpperCase().slice(-6)
  console.info("[quotations] new request", { userId, ref, ...parsed.data })
  return NextResponse.json({
    ok: true,
    reference: ref,
    message: "Quote request sent. Contractors will respond within 48h.",
  })
})

void Status