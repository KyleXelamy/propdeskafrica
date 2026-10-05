"use server"

import { createClient } from "@/lib/supabase/server"

export async function requestPasswordReset(formData: FormData) {
  const email = (formData.get("email") as string | null)?.trim()
  if (!email) return

  const supabase = await createClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  // Always send an email — never leak whether the address exists.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/reset-password`,
  })
}
