"use client"

import "leaflet/dist/leaflet.css"
import { useEffect, useMemo, useState, type FormEvent } from "react"
import Link from "next/link"
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet"
import L from "leaflet"
import { Building2, Home, Loader2, MapPin, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export type MapProperty = {
  id: string
  name: string
  address: string
  city?: string
  county?: string
  latitude: number
  longitude: number
  status?: "available" | "rented" | "maintenance" | "unknown"
  units?: number
  rent_amount?: number
}

type SearchResult = { display_name: string; lat: string; lon: string }

const propertyIcon = L.divIcon({
  className: "property-map-marker",
  html: '<div style="display:grid;place-items:center;width:34px;height:34px;border:3px solid white;border-radius:999px;background:#45604d;color:white;box-shadow:0 3px 10px rgba(0,0,0,.25)"><span style="font-size:14px;font-weight:700">P</span></div>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
})

function SearchLocation({ result }: { result: SearchResult | null }) {
  const map = useMap()
  useEffect(() => {
    if (result) map.flyTo([Number(result.lat), Number(result.lon)], 13, { duration: 0.8 })
  }, [map, result])
  return null
}

function FitProperties({ properties }: { properties: MapProperty[] }) {
  const map = useMap()
  useEffect(() => {
    if (properties.length > 1) {
      map.fitBounds(properties.map((property) => [property.latitude, property.longitude] as [number, number]), { padding: [42, 42], maxZoom: 13 })
    } else if (properties.length === 1) {
      map.setView([properties[0].latitude, properties[0].longitude], 13)
    }
  }, [map, properties])
  return null
}

export function PropertyMap({ properties, height = 520 }: { properties: MapProperty[]; height?: number }) {
  const [query, setQuery] = useState("")
  const [searching, setSearching] = useState(false)
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null)
  const [searchError, setSearchError] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const center = useMemo<[number, number]>(() => {
    if (!properties.length) return [-0.42, 37.0]
    return [properties.reduce((sum, p) => sum + p.latitude, 0) / properties.length, properties.reduce((sum, p) => sum + p.longitude, 0) / properties.length]
  }, [properties])

  async function searchLocation(event: FormEvent) {
    event.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setSearchError("")
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`)
      const data = await response.json()
      if (!response.ok || !data.result) throw new Error(data.error ?? "Location not found")
      setSearchResult(data.result)
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "Location not found")
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-muted/30" style={{ height }}>
      <div className="absolute left-4 right-4 top-4 z-[1000] flex flex-wrap gap-2">
        <form onSubmit={searchLocation} className="flex min-w-0 flex-1 gap-2 sm:max-w-md">
          <label htmlFor="map-location-search" className="sr-only">Find a town or neighbourhood</label>
          <Input id="map-location-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find Kerugoya, Kagumo, Nairobi..." className="bg-card/95 shadow-lg backdrop-blur" />
          <Button type="submit" size="icon" aria-label="Search map" disabled={searching} className="shrink-0 shadow-lg">
            {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          </Button>
        </form>
        <div className="flex items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
          <Building2 className="size-3.5" /> {properties.length} {properties.length === 1 ? "property" : "properties"}
        </div>
      </div>
      {searchError && <p role="alert" className="absolute left-4 top-20 z-[1000] rounded-lg bg-destructive px-3 py-2 text-xs text-destructive-foreground shadow-lg">{searchError}</p>}
      <MapContainer center={center} zoom={properties.length ? 11 : 7} scrollWheelZoom className="h-full w-full">
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <SearchLocation result={searchResult} />
        <FitProperties properties={properties} />
        {properties.map((property) => (
          <Marker key={property.id} position={[property.latitude, property.longitude]} icon={propertyIcon} eventHandlers={{ click: () => setSelectedId(property.id) }}>
            <Popup>
              <div className="min-w-48 space-y-2 text-sm">
                <p className="font-semibold">{property.name}</p>
                <p className="text-muted-foreground">{property.address}{property.city ? `, ${property.city}` : ""}</p>
                <p className="capitalize">{property.status ?? "unknown"}{property.rent_amount != null ? ` · KES ${property.rent_amount.toLocaleString()}/mo` : ""}</p>
                <Link href={`/dashboard/properties/${property.id}`} className="inline-flex items-center gap-1 font-medium text-primary hover:underline"><Home className="size-3.5" /> Open property</Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {selectedId && properties.some((property) => property.id === selectedId) && <div className="absolute bottom-4 left-4 right-4 z-[1000] rounded-xl border border-border bg-card/95 p-3 text-sm shadow-lg backdrop-blur"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{properties.find((property) => property.id === selectedId)?.name}</p><p className="mt-1 text-muted-foreground">{properties.find((property) => property.id === selectedId)?.address}</p></div><button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setSelectedId(null)}>Close</button></div></div>}
      {!properties.length && <div className="pointer-events-none absolute inset-x-4 bottom-4 z-[1000] rounded-xl border border-border bg-card/95 p-3 text-sm shadow-lg backdrop-blur"><p className="font-medium">No property pins yet</p><p className="mt-1 text-muted-foreground">Add a location to a property to place it on the map.</p></div>}
    </div>
  )
}
