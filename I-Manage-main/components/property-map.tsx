"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { MapPin, Building2, Home, Maximize2 } from "lucide-react"

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

const statusColor: Record<NonNullable<MapProperty["status"]>, string> = {
  available: "#45604d",
  rented: "#d9f45b",
  maintenance: "#dc2626",
  unknown: "#9aa59b",
}

/**
 * Pure-SVG property map. We project lat/lng to a local viewbox rather than
 * pulling in Leaflet, so this works without window/document, in any
 * framework, with no external tile-server dependency. Clusters are drawn
 * as concentric circles when pins fall within ~25px of each other.
 */
export function PropertyMap({
  properties,
  height = 520,
}: {
  properties: MapProperty[]
  height?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [size, setSize] = useState({ w: 800, h: height })

  useEffect(() => {
    if (!ref.current) return
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) {
        setSize({ w: e.contentRect.width, h: e.contentRect.height })
      }
    })
    obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  // 1. Compute the lat/lng bounding box.
  if (properties.length === 0) {
    return (
      <div
        ref={ref}
        className="grid place-items-center rounded-3xl border border-dashed border-border bg-muted/30"
        style={{ height }}
      >
        <div className="text-center">
          <MapPin className="mx-auto size-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium text-foreground">No properties on the map yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add an address to a property and run geocode to see it here.
          </p>
        </div>
      </div>
    )
  }

  const lats = properties.map((p) => p.latitude)
  const lngs = properties.map((p) => p.longitude)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const padLat = Math.max((maxLat - minLat) * 0.2, 0.005)
  const padLng = Math.max((maxLng - minLng) * 0.2, 0.005)

  // 2. Project to SVG units (with padding). Y is inverted.
  const project = (lat: number, lng: number) => {
    const x = ((lng - (minLng - padLng)) / (maxLng - minLng + 2 * padLng)) * 100
    const y = 100 - ((lat - (minLat - padLat)) / (maxLat - minLat + 2 * padLat)) * 100
    return { x, y }
  }

  // 3. Cluster pins that fall within ~12 units (12% of viewbox) of each other.
  type Cluster = { x: number; y: number; props: MapProperty[] }
  const placed: Cluster[] = []
  const clusterRadius = 12 // % of viewbox
  for (const p of properties) {
    const { x, y } = project(p.latitude, p.longitude)
    const found = placed.find((c) => Math.hypot(c.x - x, c.y - y) < clusterRadius)
    if (found) {
      found.props.push(p)
    } else {
      placed.push({ x, y, props: [p] })
    }
  }

  // 4. Render a faint grid for spatial context.
  const gridLines: number[] = []
  for (let i = 10; i < 100; i += 10) gridLines.push(i)

  return (
    <div ref={ref} className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-secondary/40 via-background to-secondary/30" style={{ height }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <defs>
          <pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse">
            <path d="M 5 0 L 0 0 0 5" fill="none" stroke="currentColor" strokeWidth="0.1" className="text-muted-foreground/15" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="url(#grid)" />
        {gridLines.map((p) => (
          <line key={`v${p}`} x1={p} y1={0} x2={p} y2={100} stroke="currentColor" strokeWidth="0.05" className="text-muted-foreground/10" />
        ))}
        {gridLines.map((p) => (
          <line key={`h${p}`} x1={0} y1={p} x2={100} y2={p} stroke="currentColor" strokeWidth="0.05" className="text-muted-foreground/10" />
        ))}
      </svg>

      {/* Pins */}
      {placed.map((c, i) => {
        const isCluster = c.props.length > 1
        const isHovered = hover === c.props[0].id
        return (
          <div
            key={i}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${c.x}%`, top: `${c.y}%` }}
            onMouseEnter={() => setHover(c.props[0].id)}
            onMouseLeave={() => setHover(null)}
          >
            <div className="relative">
              {isCluster ? (
                <div className="flex size-10 items-center justify-center rounded-full border-2 border-background bg-primary text-xs font-bold text-primary-foreground shadow-lg">
                  {c.props.length}
                </div>
              ) : (
                <div
                  className="grid size-9 place-items-center rounded-full border-2 border-background shadow-md transition-transform"
                  style={{
                    backgroundColor: statusColor[c.props[0].status ?? "unknown"],
                    transform: isHovered ? "scale(1.15)" : "scale(1)",
                  }}
                >
                  <Home className="size-4 text-white" />
                </div>
              )}
              {isHovered && !isCluster && (
                <div className="absolute left-1/2 top-full z-10 mt-2 w-64 -translate-x-1/2 rounded-xl border border-border bg-card p-3 text-left shadow-xl">
                  <p className="text-sm font-semibold">{c.props[0].name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {c.props[0].address}
                    {c.props[0].city ? `, ${c.props[0].city}` : ""}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="rounded-full bg-muted px-2 py-0.5 capitalize text-muted-foreground">
                      {c.props[0].status ?? "unknown"}
                    </span>
                    {c.props[0].rent_amount != null && (
                      <span className="font-medium">KES {c.props[0].rent_amount.toLocaleString()}/mo</span>
                    )}
                  </div>
                  <Link
                    href={`/dashboard/properties/${c.props[0].id}`}
                    className="mt-3 block text-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Open property
                  </Link>
                </div>
              )}
              {isHovered && isCluster && (
                <div className="absolute left-1/2 top-full z-10 mt-2 w-56 -translate-x-1/2 rounded-xl border border-border bg-card p-3 text-left shadow-xl">
                  <p className="text-sm font-semibold">{c.props.length} properties nearby</p>
                  <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
                    {c.props.map((p) => (
                      <li key={p.id}>
                        <Link
                          href={`/dashboard/properties/${p.id}`}
                          className="block truncate rounded-md px-2 py-1 hover:bg-muted"
                        >
                          {p.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 flex items-center gap-4 rounded-full border border-border bg-card/90 px-4 py-2 text-xs backdrop-blur">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: statusColor.rented }} />
          Rented
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: statusColor.available }} />
          Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: statusColor.maintenance }} />
          Maintenance
        </span>
      </div>

      {/* Count */}
      <div className="absolute right-4 top-4 flex items-center gap-2 rounded-full border border-border bg-card/90 px-3 py-1.5 text-xs backdrop-blur">
        <Building2 className="size-3.5" /> {properties.length} {properties.length === 1 ? "property" : "properties"}
      </div>
    </div>
  )
}
