import { NextResponse, type NextRequest } from "next/server"
import { withAuth } from "@/lib/api"
import { z } from "zod"

/**
 * /api/quotations
 * Landlord-side maintenance quote workflow.
 * GET   — list quotes (filter by property, status)
 * POST  — create a new quote request
 *
 * Both verbs now read and write REAL rows. The GET used to return an empty
 * array no matter what was in the database, and the POST used to log the
 * request and forget it — while answering "Quote request sent. Contractors
 * will respond within 48h."
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

export const GET = withAuth(async (request, { supabase, userId }) => {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")
  const propertyId = searchParams.get("property_id")
  const limit = Math.min(Number(searchParams.get("limit") ?? 50) || 50, 100)

  let query = supabase
    .from("quotations")
    .select(
      "id, title, description, status, amount, notes, property_id, maintenance_id, contact_id, contractor_ids, requested_at, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (status) query = query.eq("status", status)
  if (propertyId) query = query.eq("property_id", propertyId)

  const { data, error } = await query
  if (error) {
    console.error("[api/quotations] list failed", error.message)
    return NextResponse.json({ error: "Could not load quotations." }, { status: 500 })
  }

  const quotations = data ?? []
  return NextResponse.json({ count: quotations.length, quotations })
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

  const { title, property_id, maintenance_id, contractor_ids, notes } = parsed.data

  // Every referenced row must belong to the caller.
  if (property_id) {
    const { data: property } = await supabase
      .from("properties")
      .select("id")
      .eq("id", property_id)
      .eq("user_id", userId)
      .maybeSingle()
    if (!property) {
      return NextResponse.json({ error: "Property not found." }, { status: 404 })
    }
  }

  if (maintenance_id) {
    const { data: maintenance } = await supabase
      .from("maintenance_requests")
      .select("id")
      .eq("id", maintenance_id)
      .eq("user_id", userId)
      .maybeSingle()
    if (!maintenance) {
      return NextResponse.json({ error: "Maintenance request not found." }, { status: 404 })
    }
  }

  // Contractors are contacts. Every id must be a contact this landlord owns —
  // otherwise the quote would reference another landlord's contact rows.
  const { data: contractors } = await supabase
    .from("contacts")
    .select("id")
    .eq("user_id", userId)
    .in("id", contractor_ids)

  const ownedIds = new Set((contractors ?? []).map((c: { id: string }) => c.id))
  const foreign = contractor_ids.filter((id) => !ownedIds.has(id))
  if (foreign.length > 0) {
    return NextResponse.json({ error: "One or more contractors were not found." }, { status: 404 })
  }

  const { data: created, error } = await supabase
    .from("quotations")
    .insert({
      user_id: userId,
      property_id: property_id ?? null,
      maintenance_id: maintenance_id ?? null,
      contact_id: contractor_ids[0] ?? null,
      contractor_ids,
      title,
      notes: notes ?? null,
      status: "requested",
      requested_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle()

  if (error) {
    console.error("[api/quotations] insert failed", error.message)
    return NextResponse.json(
      { error: "Could not create the quote request. Please try again." },
      { status: 500 },
    )
  }

  const ref = String(created?.id ?? "")
  console.info("[quotations] request created", { userId, ref, contractors: contractor_ids.length })

  return NextResponse.json({
    ok: true,
    reference: ref,
    message: "Quote request sent. Contractors will respond within 48h.",
  })
})

void Status
