import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Briefcase, Users, Building2, BarChart3, Mail } from "lucide-react"

export const metadata: Metadata = {
  title: "Company — I-Manage",
  description: "Run your agency or company: team, landlords, aggregate reporting.",
}

export default async function CompanyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  // Tolerate missing tables (partial install). Each call returns null on
  // failure instead of throwing — the UI degrades to an empty workspace.
  const safeQuery = async <T,>(fn: () => Promise<{ data: T | null }>): Promise<T | null> => {
    try { return (await fn()).data } catch { return null }
  }

  const company = await safeQuery<{ id: string; name: string; type: string }>(() =>
    supabase.from("companies").select("id, name, type").eq("owner_id", user.id).maybeSingle(),
  )

  let team: any[] = []
  let landlords: any[] = []
  if (company) {
    const [t, l] = await Promise.all([
      safeQuery<any[]>(() =>
        supabase.from("team_members").select("id, name, email, role, accepted_at").eq("company_id", company.id).order("name"),
      ),
      safeQuery<any[]>(() =>
        supabase.from("managed_landlords").select("id, name, units, manager, revenue_share, status").eq("company_id", company.id).order("name"),
      ),
    ])
    team = t || []
    landlords = l || []
  }

  const members = team || []
  const managedLandlords = landlords || []
  const totalUnits = managedLandlords.reduce((sum, landlord) => sum + Number(landlord.units || 0), 0)

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Company</h1>
          <p className="mt-1 text-muted-foreground">
            Run your agency — team, landlords, aggregate reporting, all in one place.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">Company records are shown from your workspace database.</p>
      </header>

      {/* Top stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Landlords under management", value: managedLandlords.length, icon: Building2, sub: company ? "From managed_landlords" : "No company workspace" },
          { label: "Total units managed", value: totalUnits, icon: BarChart3, sub: "From workspace records" },
          { label: "Active team members", value: members.length, icon: Users, sub: company ? "From team_members" : "No company workspace" },
          { label: "Portfolio yield", value: "—", icon: Briefcase, sub: "No database calculation available" },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription>{s.label}</CardDescription>
                <s.icon className="size-4 text-muted-foreground" />
              </div>
              <CardTitle className="text-3xl">{s.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Team */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team</CardTitle>
              <CardDescription>Everyone with access to your I-Manage workspace.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Last seen</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {members.length === 0 ? <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">No team members are stored for this workspace.</td></tr> : members.map((m) => (
                  <tr key={m.email} className="hover:bg-muted/30">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 place-items-center rounded-full bg-secondary text-xs font-medium text-primary">
                          {m.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                        </span>
                        <span className="text-sm font-medium">{m.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant="outline">{m.role}</Badge>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Mail className="size-3" /> {m.email}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">{m.accepted_at ? new Date(m.accepted_at).toLocaleDateString() : "Invitation pending"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Landlords */}
      <Card>
        <CardHeader>
          <CardTitle>Landlords under management</CardTitle>
          <CardDescription>Each landlord sees only their own data. You see everything.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {managedLandlords.length === 0 ? <p className="col-span-full rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No managed landlords are stored for this workspace.</p> : managedLandlords.map((l) => (
              <div key={l.name} className="rounded-2xl border bg-card p-5">
                <p className="text-base font-semibold">{l.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">Manager: {l.manager || "Not assigned"}</p>
                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4">
                  <div>
                    <p className="text-2xl font-bold">{l.units}</p>
                    <p className="text-xs text-muted-foreground">Units</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{Number(l.revenue_share || 0)}%</p>
                    <p className="text-xs text-muted-foreground">of portfolio</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
