import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Briefcase, Users, Building2, BarChart3, Mail } from "lucide-react"

export const metadata: Metadata = {
  title: "Company — I-Manage",
  description: "Run your agency or company: team, landlords, aggregate reporting.",
}

const team = [
{ name: "Your name", role: "Owner", email: "you@example.com", lastSeen: "Just now" },
    { name: "Your teammate", role: "Manager", email: "teammate@example.com", lastSeen: "2 hours ago" },
  { name: "Samuel O.", role: "Agent", email: "samuel@siemax.co.ke", lastSeen: "Yesterday" },
  { name: "Fatma A.", role: "Accountant", email: "fatma@siemax.co.ke", lastSeen: "3 days ago" },
]

const landlords = [
  { name: "Highland Estates", units: 212, manager: "Wanjiku M.", share: "60%" },
  { name: "Coast Living", units: 84, manager: "Samuel O.", share: "25%" },
  { name: "Kibera Co-op", units: 245, manager: "Wanjiku M.", share: "15%" },
]

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
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 size-4" /> Invite teammate
        </Button>
      </header>

      {/* Top stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Landlords under management", value: "3", icon: Building2, sub: "Highland, Coast, Kibera" },
          { label: "Total units managed", value: "541", icon: BarChart3, sub: "Across 8 cities" },
          { label: "Active team members", value: "4", icon: Users, sub: "1 owner · 1 mgr · 2 staff" },
          { label: "Portfolio yield (Q3)", value: "6.4%", icon: Briefcase, sub: "+0.3 pts vs Q2" },
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
