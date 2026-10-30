import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api"

export const runtime = "nodejs"

export const POST = withAuth(async (_request, { supabase, userId }) => {
  const { data: properties, error } = await supabase
    .from("properties")
    .select("id, address, city, county, name")
    .eq("user_id", userId)
    .is("latitude", null)
    .limit(25)

  if (error) return NextResponse.json({ error: "Unable to load properties" }, { status: 500 })

  let updated = 0
  for (const property of properties ?? []) {
    const query = [property.address, property.city, property.county, "Kenya"].filter(Boolean).join(", ")
    if (!query) continue
    const url = new URL("https://nominatim.openstreetmap.org/search")
    url.searchParams.set("q", query)
    url.searchParams.set("format", "jsonv2")
    url.searchParams.set("limit", "1")
    const response = await fetch(url, { headers: { "User-Agent": "PropDeskAfrica/1.0 (property geocoder)" }, cache: "no-store" })
    if (!response.ok) continue
    const results = await response.json() as Array<{ lat: string; lon: string }>
    const result = results[0]
    const latitude = Number(result?.lat)
    const longitude = Number(result?.lon)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue
    const update = await supabase.from("properties").update({ latitude, longitude, geocoded_at: new Date().toISOString() }).eq("id", property.id).eq("user_id", userId)
    if (!update.error) updated += 1
    await new Promise((resolve) => setTimeout(resolve, 1100))
  }

  return NextResponse.json({ ok: true, updated, remaining: Math.max(0, (properties?.length ?? 0) - updated) })
})
