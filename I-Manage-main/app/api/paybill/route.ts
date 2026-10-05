import { NextResponse, type NextRequest } from "next/server"
import { withAuth } from "@/lib/api"
import { z } from "zod"

/**
 * /api/paybill
 * GET  — list configured paybills / tills
 * POST — register a new paybill / till
 */

const Type = z.enum(["paybill", "till"])

const CreateSchema = z.object({
  label: z.string().trim().min(1).max(80),
  number: z.string().trim().min(3).max(20),
  type: Type,
  property_ids: z.array(z.string().uuid()).min(1).max(50),
  c2b_validation_url: z.string().url().optional(),
})

export const runtime = "nodejs"

export const GET = withAuth(async () => {
  const stub = [
    {
      id: "PB-001",
      label: "Karen properties",
      number: "247247",
      type: "paybill",
      matched: 412,
      unmatched: 0,
      last_payment: "2026-10-04T17:38:00Z",
    },
    {
      id: "PB-002",
      label: "Riverside",
      number: "456456",
      type: "till",
      matched: 184,
      unmatched: 1,
      last_payment: "2026-10-04T17:06:00Z",
    },
  ]
  return NextResponse.json({ count: stub.length, paybills: stub })
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

  console.info("[paybill] new account", { userId, ...parsed.data })
  return NextResponse.json({
    ok: true,
    message: "Paybill registered. Update your Daraja C2B validation URL to start receiving payments.",
  })
})

void Type