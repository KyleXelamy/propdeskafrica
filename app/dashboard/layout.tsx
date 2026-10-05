import type React from "react"
import { headers } from "next/headers"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { NotificationsBell } from "@/components/notifications-bell"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Auth + email verification are also enforced in middleware, but we
  // re-check here so server components never see a stale session.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // Try to preserve the originally-requested URL so users land back
    // where they expected after signing in. Headers may not be available
    // in every runtime context, so fall back to /auth/login if so.
    let requested = "/dashboard"
    try {
      const h = await headers()
      const referer = h.get("x-pathname") || h.get("referer") || ""
      const m = referer.match(/(\/dashboard\/[^?#]*)/)
      if (m) requested = m[1]
    } catch {
      // ignore — fall back to default
    }
    const params = new URLSearchParams({ next: requested })
    redirect(`/auth/login?${params.toString()}`)
  }

  if (!user.email_confirmed_at) {
    redirect("/auth/verify-email?email=" + encodeURIComponent(user.email || ""))
  }

  // Pull avatar/name in the same pass — sidebar needs them on every page.
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("full_name, avatar_url")
    .eq("user_id", user.id)
    .maybeSingle()

  return (
    <div className="min-h-screen flex bg-background">
      <DashboardSidebar
        userEmail={user.email || "user@example.com"}
        userName={(profile as any)?.full_name || undefined}
        avatarUrl={(profile as any)?.avatar_url || null}
      />

      <div className="flex flex-col flex-1 min-w-0 md:ml-64">
        {/* Top header — notification bell */}
        <header className="sticky top-0 z-30 flex items-center justify-end gap-2 h-14 px-3 sm:px-4 md:px-6 bg-background/80 backdrop-blur border-b">
          <NotificationsBell />
        </header>

        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-4 md:py-6">
            <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

