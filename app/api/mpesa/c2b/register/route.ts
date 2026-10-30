import { NextResponse, type NextRequest } from "next/server"
import { withAuth, errorResponse } from "@/lib/api"
import { z } from "zod"
import { c2bRegister, isMpesaAdminEmail, mpesaAdminEmails } from "@/lib/mpesa/daraja"

/**
 * POST /api/mpesa/c2b/register
 * Register the validation + confirmation URLs for a paybill / till with
 * Safaricom Daraja. Required once per shortcode; safe to re-run.
 *
 * Body: { short_code, response_type, validation_url, confirmation_url }
 *
 * SECURITY (AUTHZ-005): this route re-points the PLATFORM's Daraja URLs using
 * the PLATFORM's own merchant credentials, so it is an operator action, not
 * a landlord action. Any signed-in user could otherwise register an
 * attacker-controlled confirmation URL for the platform paybill and receive
 * every C2B payment — payer MSISDN, legal name and amount — on their own
 * server.
 *
 * The app has no admin/role model of its own (`team_members.role` is stored
 * but never enforced — see INFRA-025), so operators are named explicitly in
 * MPESA_ADMIN_EMAILS: a comma-separated list of e-mail addresses.
 *
 *   MPESA_ADMIN_EMAILS=ops@propdesk.africa,finance@propdesk.africa
 *
 * The variable MUST be set. Unset or empty means NOBODY is an operator and
 * this route refuses to run (503) — it never falls open.
 */
const Schema = z.object({
  // Safaricom short codes are numeric (PayBill / Till numbers).
  short_code: z.string().trim().regex(/^\d{6,10}$/, "short_code must be a numeric Safaricom shortcode (6-10 digits)"),
  response_type: z.enum(["Completed", "Cancelled"]).default("Completed"),
  // Daraja only accepts publicly reachable HTTPS callbacks.
  validation_url: z.string().url().refine((u) => u.startsWith("https://"), "validation_url must be an https:// URL"),
  confirmation_url: z.string().url().refine((u) => u.startsWith("https://"), "confirmation_url must be an https:// URL"),
})

export const runtime = "nodejs"

export const POST = withAuth(async (request, { supabase, userId }) => {
  // --- operator authorisation -------------------------------------------
  if (mpesaAdminEmails().length === 0) {
    console.error("[api/mpesa/c2b/register] MPESA_ADMIN_EMAILS is not configured — refusing to register Daraja URLs")
    return errorResponse("Operator access is not configured. Set MPESA_ADMIN_EMAILS.", 503)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email ?? null
  if (!isMpesaAdminEmail(email)) {
    console.warn("[api/mpesa/c2b/register] rejected a non-operator", { userId, email })
    return errorResponse("Forbidden: only a platform operator may register Daraja URLs", 403)
  }

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

    console.info("[c2b] urls registered", { operator: email, userId, ...parsed.data, response: r })
    return NextResponse.json({ ok: true, daraja: r })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Registration failed"
    console.error("[api/mpesa/c2b/register] failed", err)
    return NextResponse.json({ error: message }, { status: 502 })
  }
})
