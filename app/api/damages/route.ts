import { NextResponse, type NextRequest } from "next/server"
import { withAuth } from "@/lib/api"
import { z } from "zod"

/**
 * /api/damages
 * GET  — list damage records for the signed-in landlord
 * POST — log a new damage with photos
 *
 * Both verbs now read and write REAL rows. The GET used to return one
 * hard-coded "Karen House 1" record regardless of whose account you were on,
 * and the POST used to log the entry and forget it.
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

export const GET = withAuth(async (_request, { supabase, userId }) => {
  const { data, error } = await supabase
    .from("damages")
    .select(
      "id, title, property_id, tenant_id, unit_id, location, severity, status, cost, estimated_cost, photos, description, reported_at, resolved_at",
    )
    .eq("user_id", userId)
    .order("reported_at", { ascending: false })

  if (error) {
    console.error("[api/damages] list failed", error.message)
    return NextResponse.json({ error: "Could not load damage records." }, { status: 500 })
  }

  const damages = data ?? []
  return NextResponse.json({ count: damages.length, damages })
})

export const POST = withAuth(async (request, { supabase, userId }) => {
  const json = await request.json().catch(() => null)
  const parsed = CreateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    )
  }

  const { title, property_id, unit_id, tenant_id, location, severity, description, estimated_cost, photos } =
    parsed.data

  // The property must belong to the caller. Without this check a landlord
  // could attach a damage record to somebody else's property id.
  const { data: property } = await supabase
    .from("properties")
    .select("id")
    .eq("id", property_id)
    .eq("user_id", userId)
    .maybeSingle()
  if (!property) {
    return NextResponse.json({ error: "Property not found." }, { status: 404 })
  }

  // Same for the tenant, when one is referenced.
  if (tenant_id) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("id", tenant_id)
      .eq("user_id", userId)
      .maybeSingle()
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found." }, { status: 404 })
    }
  }

  const { data: created, error } = await supabase
    .from("damages")
    .insert({
      user_id: userId,
      property_id,
      unit_id: unit_id ?? null,
      tenant_id: tenant_id ?? null,
      title,
      location,
      severity,
      description: description ?? null,
      estimated_cost: estimated_cost ?? null,
      photos: photos ?? [],
      status: "reported",
      reported_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle()

  if (error) {
    console.error("[api/damages] insert failed", error.message)
    return NextResponse.json(
      { error: "Could not save the damage record. Please try again." },
      { status: 500 },
    )
  }

  const ref = String(created?.id ?? "")
  console.info("[damages] record created", { userId, ref })

  return NextResponse.json({ ok: true, reference: ref })
})

void Severity
