import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, MapPin, RefreshCw } from "lucide-react"
import { PropertyMap, type MapProperty } from "@/components/property-map"
import { getDb, neonConfigured } from "@/lib/db/neon"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Properties map — I-Manage",
  description: "Every property pinned. Click for details.",
}

export const dynamic = "force-dynamic"

async function loadProperties(): Promise<MapProperty[]> {
  if (neonConfigured()) {
    try {
      const sql = getDb()
      const rows = await sql`
        select id, name, address, city, county, latitude, longitude, status, rent_amount
        from public.properties
        where latitude is not null and longitude is not null
        order by created_at desc
      `
      return rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        address: r.address,
        city: r.city,
        county: r.county,
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        status: (r.status as MapProperty["status"]) ?? "unknown",
        rent_amount: r.rent_amount != null ? Number(r.rent_amount) : undefined,
      }))
    } catch (err) {
      console.warn("[properties map] neon read failed", err)
    }
  }
  // Supabase fallback
  const supa = await createClient()
  const { data } = await supa
    .from("properties")
    .select("id, name, address, city, county, latitude, longitude, status, rent_amount")
    .not("latitude", "is", null)
    .not("longitude", "is", null)
  if (!data) return []
  return data.map((r: any) => ({
    id: r.id,
    name: r.name,
    address: r.address,
    city: r.city,
    county: r.county,
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    status: (r.status as MapProperty["status"]) ?? "unknown",
    rent_amount: r.rent_amount != null ? Number(r.rent_amount) : undefined,
  }))
}

export default async function PropertiesMapPage() {
  const properties = await loadProperties()
  const geocoded = properties.length
  const total = await countAll()

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
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="mr-2 size-3.5" /> Re-geocode all
          </Button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
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
      </div>

      <PropertyMap properties={properties} height={560} />

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