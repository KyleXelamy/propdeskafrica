import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim()
  if (!query || query.length < 2) return NextResponse.json({ error: "Enter a town or neighbourhood" }, { status: 400 })

  const search = query.toLowerCase().includes("kenya") ? query : `${query}, Kenya`
  const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ke&q=${encodeURIComponent(search)}`, {
    headers: { "User-Agent": "PropDeskAfrica/1.0 (property map)" },
    next: { revalidate: 3600 },
  })
  if (!response.ok) return NextResponse.json({ error: "Location search is temporarily unavailable" }, { status: 502 })

  const results = (await response.json()) as Array<{ display_name: string; lat: string; lon: string }>
  const result = results[0]
  if (!result) return NextResponse.json({ error: "We could not find that Kenyan location" }, { status: 404 })
  return NextResponse.json({ result })
}
