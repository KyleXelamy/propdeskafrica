import { NextResponse, type NextRequest } from "next/server"
import { withAuth } from "@/lib/api"
import { z } from "zod"
import { c2bRegister } from "@/lib/mpesa/daraja"

/**
 * POST /api/mpesa/c2b/register
 * Register the validation + confirmation URLs for a paybill / till with
 * Safaricom Daraja. Required once per shortcode; safe to re-run.
 *
 * Body: { short_code, response_type, validation_url, confirmation_url }
 */
const Schema = z.object({
  short_code: z.string().trim().min(3).max(20),
  response_type: z.enum(["Completed", "Cancelled"]).default("Completed"),
  validation_url: z.string().url(),
  confirmation_url: z.string().url(),
})

export const runtime = "nodejs"

export const POST = withAuth(async (request, { userId }) => {
  const json = await request.json().catch(() => null)
  const parsed = Schema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    )
  }

  try {
    const r = await c2bRegister({
      shortCode: parsed.data.short_code,
      responseType: parsed.data.response_type,
      validationUrl: parsed.data.validation_url,
      confirmationUrl: parsed.data.confirmation_url,
    })

    console.info("[c2b] urls registered", { userId, ...parsed.data, response: r })
    return NextResponse.json({ ok: true, daraja: r })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Registration failed"
    console.error("[api/mpesa/c2b/register] failed", err)
    return NextResponse.json({ error: message }, { status: 502 })
  }
})