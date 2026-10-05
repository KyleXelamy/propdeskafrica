import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Briefcase, Users, Building2, BarChart3, Mail } from "lucide-react"

export const metadata: Metadata = {
  title: "Company — I-Manage",
  description: "Run your agency or company: team, landlords, aggregate reporting.",
}

const team: Array<{ name: string; role: string; email: string; lastSeen: string }> = []
const landlords: Array<{ name: string; units: number; manager: string; share: string }> = []

export default function CompanyPage() {
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
          { label: "Landlords under management", value: landlords.length, icon: Building2, sub: "From managed_landlords" },
          { label: "Total units managed", value: landlords.reduce((sum, landlord) => sum + landlord.units, 0), icon: BarChart3, sub: "From workspace records" },
          { label: "Active team members", value: team.length, icon: Users, sub: "From team_members" },
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
            <Button variant="outline" size="sm">
              Manage roles
            </Button>
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
                {team.map((m) => (
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
                    <td className="px-4 py-4 text-sm text-muted-foreground">{m.lastSeen}</td>
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
            {landlords.map((l) => (
              <div key={l.name} className="rounded-2xl border bg-card p-5">
                <p className="text-base font-semibold">{l.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">Manager: {l.manager}</p>
                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4">
                  <div>
                    <p className="text-2xl font-bold">{l.units}</p>
                    <p className="text-xs text-muted-foreground">Units</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{l.share}</p>
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
