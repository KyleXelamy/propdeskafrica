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
 *   - Email verification exchanges the code and sends the user directly to the dashboard.
 *   - Other flows use the safe `next` path when provided.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const next = requestUrl.searchParams.get("next")
  // Supabase's confirmation link returns a one-time code. Exchanging it here
  // creates the session cookie, so verified users arrive already signed in.
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(next ? safeNextPath(next) : "/dashboard", requestUrl.origin))
    }
  }

  return NextResponse.redirect(
    new URL("/auth/login?error=verification_failed", requestUrl.origin),
  )
}
