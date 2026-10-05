import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

function safeNextPath(value: string | null): string {
  if (!value || typeof value !== "string") return "/dashboard"
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard"
  return value
}

/**
 * Email-verification and OAuth callback. Exchanges the `code` query
 * parameter for a session and redirects appropriately:
 *   - If this looks like an email-verification (no explicit `next`):
 *       → /auth/login?verified=true   (so the user sees a friendly notice)
 *   - Otherwise (OAuth, password recovery, magic links, etc.):
 *       → the URL passed in `next`.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const next = requestUrl.searchParams.get("next")
  // Heuristic: Supabase's email verification link has no `next` param and
  // its redirectTo points at /auth/callback. Treat that as a verification.
  const isVerification = !next

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      if (isVerification) {
        return NextResponse.redirect(
          new URL("/auth/login?verified=true", requestUrl.origin),
        )
      }
      return NextResponse.redirect(new URL(safeNextPath(next), requestUrl.origin))
    }
  }

  return NextResponse.redirect(
    new URL("/auth/login?error=verification_failed", requestUrl.origin),
  )
}
