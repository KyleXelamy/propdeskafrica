"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Building2, MapPin, Bed, Bath, Square, Loader2, Search } from "lucide-react"
import { EmptyState } from "@/components/empty-state"
import { SearchInput } from "@/components/search-input"
import Link from "next/link"
import { formatKenyaCurrency, formatDate } from "@/lib/utils"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export default function PropertiesPage() {
  const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")

  const filtered = query.trim()
    ? properties.filter((p) => {
        const q = query.toLowerCase()
        return (
          p.name?.toLowerCase().includes(q) ||
          p.address?.toLowerCase().includes(q) ||
          p.city?.toLowerCase().includes(q) ||
          p.county?.toLowerCase().includes(q) ||
          p.type?.toLowerCase().includes(q)
        )
      })
    : properties

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const supabase = createClient()
        // Pull cover photos too in a single round trip via the FK relationship.
        const { data, error } = await supabase
          .from("properties")
          .select("*, property_photos(file_url, is_cover, display_order)")
          .order("created_at", { ascending: false })

        if (error) throw error
        // Compute a cover_url per property (first is_cover=true, else first photo, else null)
        const withCover = (data || []).map((p: any) => {
          const photos = (p.property_photos || []) as any[]
          const cover = photos.find((ph) => ph.is_cover) || photos.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))[0]
          return { ...p, cover_url: cover?.file_url || null }
        })
        setProperties(withCover)
      } catch (err: any) {
        console.error("[i-manage] fetch properties error", err)
        setError(err.message || "Failed to load properties")
      } finally {
        setLoading(false)
      }
    }

    fetchProperties()
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "occupied":
        return "bg-chart-4 text-white"
      case "available":
      case "vacant":
        return "bg-secondary text-secondary-foreground"
      case "maintenance":
        return "bg-destructive text-destructive-foreground"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  return (
    <div className="space-y-4 md:space-y-6 pt-2 md:pt-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Properties</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            {properties.length === 0
              ? "Manage your rental properties"
              : `${filtered.length} of ${properties.length} properties`}
          </p>
        </div>
        <Button asChild className="bg-primary hover:bg-primary/90 w-full sm:w-auto">
          <Link href="/dashboard/properties/new">
            <Plus className="h-4 w-4 mr-2" />
            Add Property
          </Link>
        </Button>
      </div>

      {properties.length > 0 && (
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search by name, address, city, type…"
          className="max-w-md"
        />
      )}

      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !properties || properties.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No properties yet"
          description="Start by adding your first rental property to track tenants, rent, and maintenance in one place."
          action={{ label: "Add Your First Property", href: "/dashboard/properties/new" }}
        />
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="text-center py-10">
            <Search className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              No properties match &ldquo;<span className="font-medium text-foreground">{query}</span>&rdquo;.
            </p>
            <Button variant="outline" className="mt-3 bg-transparent" onClick={() => setQuery("")}>
              Clear search
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((property) => {
            const rent = property.rent_amount ?? property.monthly_rent
            return (
              <Card key={property.id} className="hover:shadow-lg transition-shadow overflow-hidden">
                {property.cover_url && (
                  <div className="aspect-[16/9] w-full overflow-hidden bg-muted -mt-6">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={property.cover_url}
                      alt={property.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                )}
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0 flex-1">
                      <CardTitle className="text-base md:text-lg truncate">{property.name}</CardTitle>
                      <div className="flex items-start text-xs md:text-sm text-muted-foreground">
                        <MapPin className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-2">{property.address}</span>
                      </div>
                    </div>
                    <Badge className={`${getStatusColor(property.status)} text-xs flex-shrink-0`}>
                      {property.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 md:space-y-4 pt-0">
                  <div className="flex items-center justify-between text-xs md:text-sm">
                    <span className="text-muted-foreground">Type:</span>
                    <span className="font-medium capitalize">{property.type || property.property_type}</span>
                  </div>

                  {rent && (
                    <div className="flex items-center justify-between text-xs md:text-sm">
                      <span className="text-muted-foreground">Monthly Rent:</span>
                      <span className="font-medium text-primary">{formatKenyaCurrency(rent)}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 md:gap-4 text-xs md:text-sm text-muted-foreground">
                    {property.bedrooms != null && (
                      <div className="flex items-center">
                        <Bed className="h-3 w-3 mr-1" />
                        {property.bedrooms}
                      </div>
                    )}
                    {property.bathrooms != null && (
                      <div className="flex items-center">
                        <Bath className="h-3 w-3 mr-1" />
                        {property.bathrooms}
                      </div>
                    )}
                    {(property.size_sqft || property.square_feet) && (
                      <div className="flex items-center">
                        <Square className="h-3 w-3 mr-1" />
                        {property.size_sqft || property.square_feet}
                      </div>
                    )}
                  </div>

                  {property.description && (
                    <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">{property.description}</p>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <Button variant="outline" size="sm" asChild className="flex-1 bg-transparent text-xs md:text-sm">
                      <Link href={`/dashboard/properties/${property.id}`}>View Details</Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild className="flex-1 bg-transparent text-xs md:text-sm">
                      <Link href={`/dashboard/properties/${property.id}/edit`}>Edit</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
