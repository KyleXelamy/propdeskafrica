import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Building2, Mail, Phone, ArrowRight, Briefcase } from "lucide-react"

export const metadata: Metadata = {
  title: "Landlords — I-Manage",
  description: "If you manage properties for multiple landlords, this is your control room.",
}

const landlords = [
  {
    slug: "highland-estates",
    name: "Highland Estates",
    units: 212,
    share: 60,
    manager: "Wanjiku M.",
    email: "owners@highland.co.ke",
    phone: "+254 711 888 999",
    monthly: 3_840_000,
    collected: 3_700_000,
  },
  {
    slug: "coast-living",
    name: "Coast Living",
    units: 84,
    share: 25,
    manager: "Samuel O.",
    email: "samuel@coastliving.co.ke",
    phone: "+254 722 333 444",
    monthly: 1_400_000,
    collected: 1_360_000,
  },
  {
    slug: "kibera-housing-co",
    name: "Kibera Housing Co-op",
    units: 245,
    share: 15,
    manager: "Wanjiku M.",
    email: "fatma@kiberacoop.co.ke",
    phone: "+254 711 000 000",
    monthly: 980_000,
    collected: 980_000,
  },
]

export default function LandlordsPage() {
  const totalUnits = landlords.reduce((sum, l) => sum + l.units, 0)
  const totalCollected = landlords.reduce((sum, l) => sum + l.collected, 0)
  const totalExpected = landlords.reduce((sum, l) => sum + l.monthly, 0)
  const totalRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Landlords</h1>
          <p className="mt-1 text-muted-foreground">
            Each landlord sees only their own data. You see everything.
          </p>
        </div>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 size-4" /> Add landlord
        </Button>
      </header>

      {/* Aggregate stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Landlords under management</CardDescription>
            <CardTitle className="text-3xl">{landlords.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total units</CardDescription>
            <CardTitle className="text-3xl">{totalUnits}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Across all landlords</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Collected (this month)</CardDescription>
            <CardTitle className="text-3xl">KES {(totalCollected / 1000).toFixed(0)}k</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">of KES {(totalExpected / 1000).toFixed(0)}k expected</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Collection rate</CardDescription>
            <CardTitle className="text-3xl text-success">{totalRate}%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
      </div>

      {/* Landlords grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {landlords.map((l) => {
          const rate = l.monthly > 0 ? Math.round((l.collected / l.monthly) * 100) : 0
          return (
            <Card key={l.slug} className="transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      <Briefcase className="mr-1 inline size-3" /> {l.share}% of portfolio
                    </p>
                    <CardTitle className="mt-1 text-xl">{l.name}</CardTitle>
                  </div>
                  <Building2 className="size-6 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 border-y border-border py-3">
                  <div>
                    <p className="text-2xl font-bold">{l.units}</p>
                    <p className="text-xs text-muted-foreground">Units</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-success">{rate}%</p>
                    <p className="text-xs text-muted-foreground">Collected</p>
                  </div>
                </div>
                <div className="space-y-1.5 text-sm">
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="size-3.5" /> {l.email}
                  </p>
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="size-3.5" /> {l.phone}
                  </p>
                  <p className="text-xs text-muted-foreground">Manager: {l.manager}</p>
                </div>
                <Link
                  href={`/dashboard/landlords/${l.slug}`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  Drill in <ArrowRight className="size-3.5" />
                </Link>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}