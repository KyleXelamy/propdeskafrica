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

export const GET = withAuth(async (_request, { supabase, userId }) => {
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id, name, type, address, phone, website")
    .eq("owner_id", userId)
    .maybeSingle()

  if (companyError) return NextResponse.json({ error: companyError.message }, { status: 500 })
  if (!company) return NextResponse.json({ workspace: null })

  const [{ data: team }, { data: landlords }] = await Promise.all([
    supabase.from("team_members").select("id, name, email, role, accepted_at").eq("company_id", company.id).order("name"),
    supabase.from("managed_landlords").select("id, name, units, manager, revenue_share, status").eq("company_id", company.id).order("name"),
  ])

  return NextResponse.json({ workspace: { company, team: team || [], landlords: landlords || [] } })
})

export const POST = withAuth(async (request, { supabase, userId }) => {
  const json = await request.json().catch(() => null)
  const parsed = InviteSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    )
  }

  const { data: company } = await supabase.from("companies").select("id").eq("owner_id", userId).maybeSingle()
  if (!company) return NextResponse.json({ error: "Create your company workspace before inviting teammates." }, { status: 409 })

  const { data: member, error } = await supabase
    .from("team_members")
    .upsert({ company_id: company.id, name: parsed.data.name, email: parsed.data.email, role: parsed.data.role }, { onConflict: "company_id,email" })
    .select("id, name, email, role, accepted_at")
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, member, message: `Teammate ${parsed.data.email} was added to the workspace.` })
})
