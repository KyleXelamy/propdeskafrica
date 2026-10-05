import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Refreshes the Supabase session cookie on every request and enforces
 * the access-control rules for the app:
 *   - Anyone hitting /dashboard/** without a session is redirected to /auth/login.
 *   - Anyone hitting /api/** without a session gets a 401 JSON response.
 *   - Authenticated users without a verified email hitting /dashboard/**
 *     are redirected to /auth/verify-email.
 *   - Authenticated users hitting /auth/login or /auth/sign-up are bounced
 *     straight into the dashboard.
 *
 * This is the SINGLE source of truth for access control — the rest of the
 * app trusts the cookies and reads `supabase.auth.getUser()` to learn who
 * the current user is.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // Allow the request to continue so the dev experience doesn't completely
    // break when env vars are missing, but skip auth enforcement.
    return response
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  // IMPORTANT: must use getUser() not getSession() — getSession() trusts
  // the cookie contents without validation, getUser() hits the auth server.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname, search } = request.nextUrl

  const isDashboard = pathname.startsWith("/dashboard")
  const isApi = pathname.startsWith("/api/")
  const isExternalApi =
    pathname === "/api/health" ||
    pathname === "/api/cron/run" ||
    pathname === "/api/mpesa/callback"
  const isAuthPage =
    pathname.startsWith("/auth/login") ||
    pathname.startsWith("/auth/sign-up")
  const isPublicAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"

  // Already authenticated users shouldn't see login / sign-up again.
  // The `next` value is sanitized to prevent open-redirect attacks.
  if (user && isAuthPage) {
    const redirectTo = safeNextPath(searchParamsGet(search, "next")) || "/dashboard"
    return NextResponse.redirect(new URL(redirectTo, request.url))
  }

  // Unauthenticated access to protected areas
  if (!user && isDashboard) {
    const url = new URL("/auth/login", request.url)
    url.searchParams.set("next", pathname + search)
    return NextResponse.redirect(url)
  }

  if (!user && isApi && !isExternalApi) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "content-type": "application/json" } },
    )
  }

  // Email verification gate for the dashboard
  if (user && isDashboard && !user.email_confirmed_at) {
    const url = new URL("/auth/verify-email", request.url)
    url.searchParams.set("email", user.email || "")
    return NextResponse.redirect(url)
  }

  return response
}

function searchParamsGet(search: string, key: string): string | null {
  if (!search) return null
  const params = new URLSearchParams(search)
  return params.get(key)
}

/**
 * Strictly sanitize a "next" redirect target so we can't be tricked into
 * bouncing users off-site (e.g. /auth/login?next=//evil.com).
 * Only same-origin relative paths are allowed.
 */
function safeNextPath(value: string | null | undefined): string {
  if (!value || typeof value !== "string") return ""
  if (!value.startsWith("/") || value.startsWith("//")) return ""
  if (/[\u0000-\u001f\u007f]/.test(value)) return ""
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(value)) return ""
  return value
}
