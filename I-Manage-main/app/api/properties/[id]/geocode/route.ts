import { NextResponse, type NextRequest } from "next/server"
import { withAuth } from "@/lib/api"
import { neonConfigured, getDb } from "@/lib/db/neon"

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

export const POST = withAuth(async (request, { userId }, { id }) => {
  if (!neonConfigured()) {
    return NextResponse.json({ error: "Geocoding requires DATABASE_URL" }, { status: 501 })
  }
  const sql = getDb()
  const rows = await sql`
    select id, address, city, county, country, name
    from public.properties
    where id = ${id} and user_id = ${userId}
    limit 1
  `
  if (rows.length === 0) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 })
  }
  const p = rows[0]
  const query = [p.address, p.city, p.county, p.country].filter(Boolean).join(", ")
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
    await sql`
      update public.properties
      set latitude = ${lat}, longitude = ${lon}, geocoded_at = now()
      where id = ${id} and user_id = ${userId}
    `
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