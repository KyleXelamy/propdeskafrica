import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, ShieldAlert, Camera, MapPin, ArrowRight, Wrench } from "lucide-react"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Damages & inspections — PropDesk Africa",
  description: "Photo-document move-in condition, track damages, settle deposits fairly.",
}

const severityStyle: Record<string, string> = {
  Low: "bg-muted text-muted-foreground",
  Medium: "bg-warning/15 text-warning",
  High: "bg-destructive/15 text-destructive",
}

export default async function DamagesPage() {
  const supabase = await createClient()
  const { data: damageRows } = await supabase
    .from("damages")
    .select("id, title, property_id, tenant_id, location, severity, status, cost, estimated_cost, photos, reported_at, resolved_at")
    .order("reported_at", { ascending: false })

  const damages = damageRows ?? []
  const activeDamages = damages.filter((damage) => !["resolved", "written_off"].includes(damage.status))
  const openRepairValue = activeDamages.reduce((sum, damage) => sum + (damage.cost ?? damage.estimated_cost ?? 0), 0)
  const depositDeductions = damages
    .filter((damage) => damage.status === "deposit_deduction")
    .reduce((sum, damage) => sum + (damage.cost ?? 0), 0)
  const resolvedDamages = damages.filter((damage) => damage.resolved_at)
  const averageResolutionDays = resolvedDamages.length
    ? Math.round(resolvedDamages.reduce((sum, damage) => sum + (new Date(damage.resolved_at).getTime() - new Date(damage.reported_at).getTime()) / 86400000, 0) / resolvedDamages.length)
    : 0

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Damages & inspections</h1>
          <p className="mt-1 text-muted-foreground">
            Photo-document move-in condition, log damages, attach repairs. Use it at exit for fair deposit settlement.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Camera className="mr-2 size-4" /> Log damage
          </Button>
          <Button className="bg-primary hover:bg-primary/90">
            <Plus className="mr-2 size-4" /> New inspection
          </Button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active damages</CardDescription>
            <CardTitle className="text-3xl">{activeDamages.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Live records from your database</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Open repair value</CardDescription>
            <CardTitle className="text-3xl">KES {openRepairValue.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Budget vs. actual</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Deposit deductions YTD</CardDescription>
            <CardTitle className="text-3xl">KES {depositDeductions.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Based on recorded deductions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg. resolution</CardDescription>
            <CardTitle className="text-3xl">{averageResolutionDays} days</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">From log → resolved</p>
          </CardContent>
        </Card>
      </div>

      {/* Active damages */}
      <Card>
        <CardHeader>
          <CardTitle>Active damages</CardTitle>
          <CardDescription>All open damage records across your properties.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Damage</th>
                  <th className="px-4 py-3">Property / Tenant</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3 text-right">Cost</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {damages.map((d) => (
                  <tr key={d.id} className="hover:bg-muted/30">
                    <td className="px-4 py-4">
                      <p className="font-mono text-xs text-muted-foreground">{d.id}</p>
                      <p className="mt-1 text-sm font-medium">{d.title}</p>
                      <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <Camera className="size-3" /> {d.photos?.length ?? 0} photos
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm font-medium">Property {d.property_id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">{d.tenant_id ? `Tenant ${d.tenant_id.slice(0, 8)}` : "No tenant linked"}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="size-3" /> {d.location}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <Badge className={severityStyle[d.severity]}>{d.severity}</Badge>
                    </td>
                    <td className="px-4 py-4 text-right text-sm font-semibold">
                      KES {d.cost.toLocaleString()}
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant="outline">{d.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Inspection checklists</CardTitle>
          <CardDescription>Pre-built templates by property type — start in seconds.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { name: "Studio move-in", items: 18 },
              { name: "1-bed move-in", items: 28 },
              { name: "3-bed move-in", items: 42 },
              { name: "Move-out", items: 38 },
            ].map((t) => (
              <Link
                key={t.name}
                href="/templates"
                className="group rounded-2xl border bg-card p-5 transition-colors hover:border-primary"
              >
                <ShieldAlert className="size-5 text-primary" />
                <p className="mt-4 text-sm font-medium">{t.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t.items} check items</p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary">
                  Use template <ArrowRight className="size-3" />
                </span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Damages → maintenance → repair</CardTitle>
          <CardDescription>One record from log to resolution, with proof.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Every damage record links to a maintenance ticket and a quotation when work starts. Photos
            taken at move-in live forever next to the unit, so end-of-tenancy deposit disputes are settled in minutes, not court.
          </p>
          <Button variant="outline" size="sm" className="mt-4" asChild>
            <Link href="/dashboard/maintenance">
              <Wrench className="mr-2 size-4" /> Open maintenance
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
