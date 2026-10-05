import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Mail, Phone, Building2, Users, Wallet, Wrench, TrendingUp, FileText } from "lucide-react"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  return { title: `${slug} — Landlord drill-down — I-Manage` }
}

const landlords = {
  "highland-estates": {
    name: "Highland Estates",
    units: 212,
    cities: ["Eldoret", "Kitale"],
    contact: { email: "owners@highland.co.ke", phone: "+254 711 888 999" },
    manager: "Wanjiku M.",
    share: 60,
    monthly: 3_840_000,
    collected: 3_700_000,
    ytd: 38_240_000,
  },
  "coast-living": {
    name: "Coast Living",
    units: 84,
    cities: ["Mombasa", "Diani"],
    contact: { email: "samuel@coastliving.co.ke", phone: "+254 722 333 444" },
    manager: "Samuel O.",
    share: 25,
    monthly: 1_400_000,
    collected: 1_360_000,
    ytd: 12_600_000,
  },
  "kibera-housing-co": {
    name: "Kibera Housing Co-op",
    units: 245,
    cities: ["Nairobi"],
    contact: { email: "fatma@kiberacoop.co.ke", phone: "+254 711 000 000" },
    manager: "Wanjiku M.",
    share: 15,
    monthly: 980_000,
    collected: 980_000,
    ytd: 9_800_000,
  },
} as const

const sampleProperties = [
  { name: "Karen House 1", city: "Eldoret", units: 12, rent: 84_000, occupancy: "100%" },
  { name: "Karen House 2", city: "Eldoret", units: 18, rent: 132_000, occupancy: "94%" },
  { name: "Riverside Apartments", city: "Eldoret", units: 24, rent: 198_000, occupancy: "92%" },
  { name: "Highway View", city: "Kitale", units: 8, rent: 56_000, occupancy: "100%" },
  { name: "Greenfield Block A", city: "Eldoret", units: 16, rent: 124_000, occupancy: "100%" },
]

const sampleTenants = [
  { name: "Brian Mwangi", property: "Karen House 1", unit: "1A", rent: 7_500, status: "Paid" },
  { name: "Aisha Otieno", property: "Karen House 1", unit: "2B", rent: 7_500, status: "Paid" },
  { name: "Joseph Kamau", property: "Riverside Apartments", unit: "4B", rent: 9_000, status: "Pending" },
  { name: "Sarah Wanjiku", property: "Highway View", unit: "1", rent: 7_000, status: "Paid" },
  { name: "James Otieno", property: "Greenfield Block A", unit: "3A", rent: 8_000, status: "Late" },
]

export default async function LandlordDrillDown({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const data = (landlords as Record<string, (typeof landlords)[keyof typeof landlords] | undefined>)[slug]
  if (!data) notFound()

  const rate = data.monthly > 0 ? Math.round((data.collected / data.monthly) * 100) : 0

  return (
    <div className="space-y-8">
      <header>
        <Link
          href="/dashboard/landlords"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> All landlords
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {data.share}% of your portfolio · Manager: {data.manager}
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">{data.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="size-3.5" /> {data.contact.email}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Phone className="size-3.5" /> {data.contact.phone}
              </span>
              <span>{data.cities.join(" · ")}</span>
            </p>
          </div>
          <Button variant="outline" size="sm">Export</Button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Units under management</CardDescription>
            <CardTitle className="text-3xl">{data.units}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Across {data.cities.length} {data.cities.length === 1 ? "city" : "cities"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Expected this month</CardDescription>
            <CardTitle className="text-3xl">KES {(data.monthly / 1000).toFixed(0)}k</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">From rent rolls</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Collected</CardDescription>
            <CardTitle className="text-3xl">KES {(data.collected / 1000).toFixed(0)}k</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-success">{rate}% of expected</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>YTD revenue</CardDescription>
            <CardTitle className="text-3xl">KES {(data.ytd / 1_000_000).toFixed(1)}M</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">This year to date</p>
          </CardContent>
        </Card>
      </div>

      {/* Properties */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Properties</CardTitle>
              <CardDescription>All {data.units} units, across {data.cities.length} {data.cities.length === 1 ? "city" : "cities"}.</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/properties?landlord=${slug}`}>
                <Building2 className="mr-2 size-3.5" /> All properties
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Property</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3 text-right">Units</th>
                  <th className="px-4 py-3 text-right">Monthly rent</th>
                  <th className="px-4 py-3 text-right">Occupancy</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sampleProperties.map((p) => (
                  <tr key={p.name} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{p.city}</td>
                    <td className="px-4 py-3 text-right text-sm">{p.units}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium">
                      KES {p.rent.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Badge variant={p.occupancy === "100%" ? "default" : "secondary"}>
                        {p.occupancy}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Tenants */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Tenants</CardTitle>
              <CardDescription>All active tenants for this landlord.</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/tenants?landlord=${slug}`}>
                <Users className="mr-2 size-3.5" /> All tenants
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Tenant</th>
                  <th className="px-4 py-3">Property</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3 text-right">Rent</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sampleTenants.map((t) => (
                  <tr key={t.name} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm font-medium">{t.name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{t.property}</td>
                    <td className="px-4 py-3 text-sm font-mono">{t.unit}</td>
                    <td className="px-4 py-3 text-right text-sm">KES {t.rent.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          t.status === "Paid" ? "default" :
                          t.status === "Pending" ? "secondary" :
                          "destructive"
                        }
                      >
                        {t.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Quick links */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: TrendingUp, label: "Reports", href: "/dashboard/reports" },
          { icon: Wallet, label: "Finances", href: "/dashboard/finances" },
          { icon: Wrench, label: "Maintenance", href: "/dashboard/maintenance" },
          { icon: FileText, label: "Documents", href: "/dashboard/documents" },
        ].map((l) => (
          <Link
            key={l.label}
            href={l.href}
            className="group flex items-center gap-3 rounded-2xl border bg-card p-5 transition-colors hover:border-primary"
          >
            <l.icon className="size-5 text-primary" />
            <span className="text-sm font-medium">{l.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}