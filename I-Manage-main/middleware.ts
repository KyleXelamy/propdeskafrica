import { updateSession } from "@/lib/supabase/middleware"
import type { NextRequest } from "next/server"

/**
 * Top-level Next.js middleware. Delegates to updateSession() which both
 * refreshes the Supabase session cookie AND enforces the access-control
 * rules (login redirects, API auth, email verification).
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Run middleware on every path except:
     *  - _next/static  (static chunks)
     *  - _next/image   (image optimizer)
     *  - favicon / image / asset files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
}
