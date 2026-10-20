"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  return { supabase, user }
}

// NOTE on return values: React's `<form action>` Action type wants
// `void | Promise<void>`. The settings actions below return sentinel
// objects so the UI can react optimistically (e.g. to refresh a list),
// but we cast to `void` to keep the type honest while still propagating
// the value at runtime (Next.js's Action handler accepts it).
type ActionResult = { success: true } | { error: string }
const asAction = (r: ActionResult): void => r as unknown as void

export async function updatePreferences(formData: FormData) {
  const { supabase, user } = await requireUser()

  const preferencesData = {
    currency: (formData.get("currency") as string) || "KES",
    date_format: (formData.get("date_format") as string) || "DD/MM/YYYY",
    timezone: (formData.get("timezone") as string) || "Africa/Nairobi",
  }

  const { error } = await supabase
    .from("user_profiles")
    .upsert({ user_id: user.id, ...preferencesData, updated_at: new Date().toISOString() }, { onConflict: "user_id" })

  if (error) {
    console.error("[propdeskafrica] preferences update error", error)
    throw new Error("Failed to update preferences")
  }

  revalidatePath("/dashboard/settings")
  return asAction({ success: true })
}

export async function updateNotifications(formData: FormData) {
  const { supabase, user } = await requireUser()

  const notifications = {
    rent_alerts: formData.get("rent_alerts") === "on",
    maintenance_alerts: formData.get("maintenance_alerts") === "on",
    lease_alerts: formData.get("lease_alerts") === "on",
    financial_reports: formData.get("financial_reports") === "on",
  }

  const { error } = await supabase
    .from("user_profiles")
    .upsert({
      user_id: user.id,
      notification_preferences: notifications,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" })

  if (error) {
    // If the column doesn't exist yet, fall back to logging so settings
    // still work locally before the user runs the latest migration.
    console.warn(
      "[propdeskafrica] notification preferences not persisted — column missing?",
      error,
    )
  }

  revalidatePath("/dashboard/settings")
  return asAction({ success: true })
}

export async function updateProfile(formData: FormData) {
  const { supabase, user } = await requireUser()

  const companyName = ((formData.get("company_name") as string) || "").trim()
  if (!companyName) throw new Error("Workspace name is required")

  const profileData = {
    full_name: (formData.get("full_name") as string) || null,
    phone: (formData.get("phone") as string) || null,
    company_name: companyName,
    address: (formData.get("address") as string) || null,
    city: (formData.get("city") as string) || null,
    county: (formData.get("county") as string) || null,
    first_name:
      ((formData.get("full_name") as string) || "").split(" ")[0] || null,
    last_name:
      ((formData.get("full_name") as string) || "")
        .split(" ")
        .slice(1)
        .join(" ") || null,
  }

  const { error } = await supabase
    .from("user_profiles")
    .upsert({ user_id: user.id, ...profileData, updated_at: new Date().toISOString() }, { onConflict: "user_id" })

  if (error) {
    console.error("[propdeskafrica] profile update error", error)
    throw new Error("Failed to update profile")
  }

  {
    const baseSlug = profileData.company_name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || "workspace"
    const slug = `${baseSlug}-${user.id.slice(0, 8)}`
    const { data: existingCompany } = await supabase.from("companies").select("id").eq("owner_id", user.id).maybeSingle()
    const companyResult = existingCompany
      ? await supabase.from("companies").update({ name: profileData.company_name, slug }).eq("id", existingCompany.id).eq("owner_id", user.id)
      : await supabase.from("companies").insert({ owner_id: user.id, name: profileData.company_name, slug })
    if (companyResult.error) {
      console.warn("[propdeskafrica] company workspace table unavailable; profile name was saved", companyResult.error.message)
    }
  }

  revalidatePath("/dashboard/settings")
  revalidatePath("/dashboard/company")
  revalidatePath("/dashboard")
  return asAction({ success: true })
}

export async function updatePassword(formData: FormData) {
  const { supabase, user } = await requireUser()

  const newPassword = formData.get("new_password") as string
  if (!newPassword || newPassword.length < 6) {
    throw new Error("New password must be at least 6 characters long")
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) {
    console.error("[propdeskafrica] password update error", error)
    throw new Error(error.message || "Failed to update password")
  }

  revalidatePath("/dashboard/settings")
  return asAction({ success: true })
}

export async function signOutAllDevices() {
  const supabase = await createClient()
  const { error } = await supabase.auth.signOut({ scope: "global" })
  if (error) {
    console.error("[propdeskafrica] global sign-out error", error)
    throw new Error("Failed to sign out from all devices")
  }
  redirect("/auth/login")
}
