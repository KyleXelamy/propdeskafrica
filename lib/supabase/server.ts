import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

// Check if Supabase environment variables are available
export const isSupabaseConfigured =
  typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL.length > 0 &&
  typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === "string" &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length > 0

/**
 * Server-side Supabase client.
 *
 * This uses the @supabase/ssr cookie adapter so that:
 *   - The session cookie is read on every request.
 *   - getUser() actually validates the JWT against the Supabase Auth server
 *     (unlike getSession(), which only decodes the cookie locally and can be
 *     spoofed by a client). Always prefer getUser() for access control.
 *   - Row Level Security policies kick in correctly because the client
 *     forwards the user's auth header.
 *
 * NOTE: do not cache this client across requests — always call createClient()
 * inside the request handler so the cookie adapter sees the current request.
 */
export async function createClient() {
  const cookieStore = await cookies()

  if (!isSupabaseConfigured) {
    console.error("[supabase] Missing server environment variables")
    return unavailableClient() as any
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    },
  )
}

function unavailableClient() {
  const unavailable = { message: "Supabase is not configured" }
  return {
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: unavailable }),
      getSession: () => Promise.resolve({ data: { session: null }, error: unavailable }),
    },
    from: () => ({
      select: () => ({ eq: () => Promise.resolve({ data: null, error: unavailable }) }),
      insert: () => Promise.resolve({ data: null, error: unavailable }),
      update: () => ({ eq: () => Promise.resolve({ data: null, error: unavailable }) }),
      delete: () => ({ eq: () => Promise.resolve({ error: unavailable }) }),
    }),
  }
}
