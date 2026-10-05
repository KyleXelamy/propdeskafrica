import { NextResponse, type NextRequest } from "next/server"
import { withAuth } from "@/lib/api"

/**
 * POST /api/properties/[id]/geocode
 *
 * Forward-geocodes a property's address via OpenStreetMap Nominatim and
 * persists the result. Free, no API key, but rate-limited (1 req/sec).
 * Nominatim requires a meaningful User-Agent / Referer so we set the
 * "email" query param when configured via env (Nominatim usage policy).
 */
export const runtime = "nodejs"

const NOMINATIM = "https://nominatim.openstreetmap.org/search"

export const POST = withAuth(async (_request, { supabase, userId }, { id }) => {
  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("id, address, city, county, name")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle()

  if (propertyError) {
    console.error("[geocode] property lookup failed", propertyError)
    return NextResponse.json({ error: "Unable to load property" }, { status: 500 })
  }
  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 })
  }

  const query = [property.address, property.city, property.county, "Kenya"].filter(Boolean).join(", ")
  if (!query) {
    return NextResponse.json({ error: "Property has no address to geocode" }, { status: 400 })
  }

  const url = new URL(NOMINATIM)
  url.searchParams.set("q", query)
  url.searchParams.set("format", "json")
  url.searchParams.set("limit", "1")
  if (process.env.NOMINATIM_EMAIL) url.searchParams.set("email", process.env.NOMINATIM_EMAIL)

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "I-Manage/1.0 (property geocoder)",
        "Accept": "application/json",
      },
      cache: "no-store",
    })
    if (!res.ok) {
      return NextResponse.json({ error: `Nominatim ${res.status}` }, { status: 502 })
    }
    const data = (await res.json()) as Array<{ lat: string; lon: string; display_name?: string }>
    if (data.length === 0) {
      return NextResponse.json({ ok: false, message: "No result", query }, { status: 200 })
    }
    const lat = Number(data[0].lat)
    const lon = Number(data[0].lon)
    if (!isFinite(lat) || !isFinite(lon)) {
      return NextResponse.json({ error: "Invalid Nominatim response" }, { status: 502 })
    }
    const { error: updateError } = await supabase
      .from("properties")
      .update({ latitude: lat, longitude: lon, geocoded_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId)

    if (updateError) {
      console.error("[geocode] coordinate update failed", updateError)
      return NextResponse.json(
        { error: "Geocoding columns are not available. Run the property geocoding migration first." },
        { status: 503 },
      )
    }
    return NextResponse.json({
      ok: true,
      latitude: lat,
      longitude: lon,
      display_name: data[0].display_name,
    })
  } catch (err) {
    console.error("[geocode] failed", err)
    return NextResponse.json({ error: "Geocoding request failed" }, { status: 502 })
  }
})
