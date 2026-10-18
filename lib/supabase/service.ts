import { createClient as createSupabaseClient } from "@supabase/supabase-js"

/**
 * Service-role Supabase client.
 *
 * Bypasses Row Level Security. Use ONLY for:
 *   - public callbacks (Daraja C2B confirmation) that need to insert
 *     on behalf of a user
 *   - cross-tenant maintenance scripts
 *   - reconciliation engine writes that the user didn't author
 *
 * NEVER expose this client to the browser. The `SUPABASE_SERVICE_ROLE_KEY`
 * has admin privileges on your database.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error("[supabase/service] service role is not configured")
    return null
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export const isServiceRoleConfigured = () =>
  typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL.length > 0 &&
  typeof process.env.SUPABASE_SERVICE_ROLE_KEY === "string" &&
  process.env.SUPABASE_SERVICE_ROLE_KEY.length > 0
