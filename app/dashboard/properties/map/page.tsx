import type { Metadata } from "next"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, MapPin, RefreshCw } from "lucide-react"
import { PropertyMap, type MapProperty } from "@/components/property-map"
import { getDb, neonConfigured } from "@/lib/db/neon"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Properties map — PropDesk Africa",
  description: "Every property pinned. Click for details.",
}

export const dynamic = "force-dynamic"

type PropertyRow = {
  id: string
  name: string
  address: string
  city: string | null
  county: string | null
  status: string | null
  rent_amount: number | string | null
  latitude?: number | string | null
  longitude?: number | string | null
}

function toMapProperty(row: PropertyRow): MapProperty | null {
  const latitude = Number(row.latitude)
  const longitude = Number(row.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null

  const status: MapProperty["status"] =
    row.status === "occupied" ? "rented" : row.status === "vacant" ? "available" : row.status as MapProperty["status"]

  return {
    id: row.id,
    name: row.name,
    address: row.address,
    city: row.city ?? undefined,
    county: row.county ?? undefined,
    latitude,
    longitude,
    status: status ?? "unknown",
    rent_amount: row.rent_amount != null ? Number(row.rent_amount) : undefined,
  }
}

async function loadProperties(): Promise<MapProperty[]> {
  const supa = await createClient()
  const withCoordinates = await supa
    .from("properties")
    .select("id, name, address, city, county, latitude, longitude, status, rent_amount")
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .order("created_at", { ascending: false })

  if (!withCoordinates.error) {
    return (withCoordinates.data ?? []).map((row: PropertyRow) => toMapProperty(row)).filter((row: MapProperty | null): row is MapProperty => row !== null)
  }

  // Older Supabase schemas may not have geocoding columns yet. Keep the map
  // usable and let the total-property count still reflect real data.
  console.warn("[properties map] coordinate columns unavailable; showing empty map", withCoordinates.error.message)
  return []
}

export default async function PropertiesMapPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const query = ((await searchParams).q || "").trim().toLowerCase()
  const allProperties = await loadProperties()
  const properties = query ? allProperties.filter((property) => [property.name, property.address, property.city, property.county].filter(Boolean).join(" ").toLowerCase().includes(query)) : allProperties
  const geocoded = properties.length
  const total = await countAll()
  const locations = Object.entries(properties.reduce<Record<string, number>>((groups, property) => { const key = property.city || property.county || "Unspecified"; groups[key] = (groups[key] || 0) + 1; return groups }, {})).sort((a, b) => b[1] - a[1])
  const occupied = properties.filter((property) => property.status === "rented").length
  const monthlyRent = properties.reduce((sum, property) => sum + (property.rent_amount || 0), 0)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/dashboard/properties"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Back to properties
          </Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Properties map</h1>
          <p className="mt-1 text-muted-foreground">
            Every geocoded property pinned. Hover for quick stats; click to open.
          </p>
        </div>
        <form className="flex gap-2" method="get"><Input name="q" defaultValue={query} placeholder="Search city, county, or property" aria-label="Search locations" /><Button type="submit" variant="outline" size="sm">Search</Button></form>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="mr-2 size-3.5" /> Re-geocode all
          </Button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>On the map</CardDescription>
            <CardTitle className="text-3xl">{geocoded}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total properties</CardDescription>
            <CardTitle className="text-3xl">{total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Need geocoding</CardDescription>
            <CardTitle className="text-3xl">{Math.max(0, total - geocoded)}</CardTitle>
          </CardHeader>
        </Card>
        <Card><CardHeader className="pb-2"><CardDescription>Occupied</CardDescription><CardTitle className="text-3xl">{occupied}</CardTitle><p className="text-xs text-muted-foreground">of mapped properties</p></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Monthly rent</CardDescription><CardTitle className="text-xl">KES {monthlyRent.toLocaleString()}</CardTitle><p className="text-xs text-muted-foreground">from mapped records</p></CardHeader></Card>
      </div>
      <div className="grid gap-3 sm:grid-cols-2"><Card><CardHeader className="pb-2"><CardDescription>Top location</CardDescription><CardTitle className="text-2xl">{locations[0]?.[0] || "—"}</CardTitle><p className="text-xs text-muted-foreground">{locations[0] ? `${locations[0][1]} properties` : "Add location data to see concentration"}</p></CardHeader></Card><Card><CardHeader className="pb-2"><CardDescription>Coverage</CardDescription><CardTitle className="text-2xl">{total ? Math.round((geocoded / total) * 100) : 0}%</CardTitle><p className="text-xs text-muted-foreground">of properties mapped</p></CardHeader></Card></div>

      <PropertyMap properties={properties} height={560} />

      <Card><CardHeader><CardTitle>Portfolio by location</CardTitle><CardDescription>Real property concentration by city or county.</CardDescription></CardHeader><CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{locations.slice(0, 8).map(([location, count]) => <div key={location} className="rounded-lg border p-3"><p className="text-sm font-medium">{location}</p><p className="mt-1 text-2xl font-semibold">{count}</p><p className="text-xs text-muted-foreground">properties</p></div>)}</CardContent></Card>

      <Card>
        <CardHeader>
          <CardTitle>Tip</CardTitle>
          <CardDescription>How pins are placed</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Each property is projected from its latitude/longitude. Open a property and click{" "}
          <MapPin className="inline size-3.5 align-text-bottom" /> <em>Geocode</em> to fill in
          coordinates automatically using OpenStreetMap Nominatim (free, no API key).
        </CardContent>
      </Card>
    </div>
  )
}

async function countAll(): Promise<number> {
  if (neonConfigured()) {
    try {
      const sql = getDb()
      const rows = await sql`select count(*)::int as n from public.properties`
      return rows[0]?.n ?? 0
    } catch {
      // fall through
    }
  }
  const supa = await createClient()
  const { count } = await supa.from("properties").select("*", { count: "exact", head: true })
  return count ?? 0
}
