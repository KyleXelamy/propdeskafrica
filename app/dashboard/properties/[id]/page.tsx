"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Edit, MapPin, Bed, Bath, Square, DollarSign, Calendar, Loader2 } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { DeleteButton } from "@/components/delete-button"
import { PropertyPhotoGallery } from "@/components/property-photo-gallery"
import { formatCurrency, formatDate, tenantName } from "@/lib/utils"

export default function PropertyPage() {
  const params = useParams<{ id: string }>()
  const [property, setProperty] = useState<any>(null)
  const [tenants, setTenants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!params?.id) return
    const fetchData = async () => {
      try {
        const supabase = createClient()
        const [propRes, tenantsRes] = await Promise.all([
          supabase.from("properties").select("*").eq("id", params.id).maybeSingle(),
          supabase.from("tenants").select("*").eq("property_id", params.id).eq("status", "active"),
        ])
        if (!propRes.data) {
          setNotFound(true)
        } else {
          setProperty(propRes.data)
        }
        setTenants(tenantsRes.data || [])
      } catch (error) {
        console.error("[i-manage] fetch property error", error)
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [params?.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (notFound || !property) {
    return (
      <div className="text-center py-10 space-y-4">
        <p className="text-muted-foreground">Property not found</p>
        <Button asChild variant="outline">
          <Link href="/dashboard/properties">Back to Properties</Link>
        </Button>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "occupied":
        return "bg-chart-4 text-white"
      case "vacant":
      case "available":
        return "bg-secondary text-secondary-foreground"
      case "maintenance":
        return "bg-destructive text-destructive-foreground"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const rent = property.rent_amount ?? property.monthly_rent
  const size = property.size_sqft ?? property.square_feet

  return (
    <div className="space-y-6 pt-2 md:pt-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">{property.name}</h1>
          <div className="flex items-center text-muted-foreground mt-1 text-sm md:text-base">
            <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
            <span>{property.address}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={getStatusColor(property.status)}>{property.status}</Badge>
          <Button asChild size="sm">
            <Link href={`/dashboard/properties/${property.id}/edit`}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Link>
          </Button>
          <DeleteButton
            endpoint={`/api/properties/${property.id}`}
            resource="property"
            redirectTo="/dashboard/properties"
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Property Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type:</span>
                <span className="font-medium capitalize">{property.type || property.property_type}</span>
              </div>

              {property.bedrooms != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bedrooms:</span>
                  <div className="flex items-center">
                    <Bed className="h-4 w-4 mr-1" />
                    {property.bedrooms}
                  </div>
                </div>
              )}

              {property.bathrooms != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bathrooms:</span>
                  <div className="flex items-center">
                    <Bath className="h-4 w-4 mr-1" />
                    {property.bathrooms}
                  </div>
                </div>
              )}

              {size && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Size (sqft):</span>
                  <div className="flex items-center">
                    <Square className="h-4 w-4 mr-1" />
                    {Number(size).toLocaleString()}
                  </div>
                </div>
              )}

              <Separator />

              {rent && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monthly Rent:</span>
                  <div className="flex items-center font-medium text-primary">
                    <DollarSign className="h-4 w-4 mr-1" />
                    {formatCurrency(rent)}
                  </div>
                </div>
              )}

              {property.deposit_amount && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Security Deposit:</span>
                  <div className="flex items-center">
                    <DollarSign className="h-4 w-4 mr-1" />
                    {formatCurrency(property.deposit_amount)}
                  </div>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-muted-foreground">Created:</span>
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-1" />
                  {formatDate(property.created_at)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current Tenants</CardTitle>
            <CardDescription>
              {tenants && tenants.length > 0 ? `${tenants.length} active tenant(s)` : "No active tenants"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tenants && tenants.length > 0 ? (
              <div className="space-y-3">
                {tenants.map((tenant) => (
                  <div key={tenant.id} className="flex items-center justify-between p-3 border rounded-lg gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{tenantName(tenant)}</div>
                      <div className="text-sm text-muted-foreground truncate">{tenant.email}</div>
                    </div>
                    <Button variant="outline" size="sm" asChild className="flex-shrink-0">
                      <Link href={`/dashboard/tenants/${tenant.id}`}>View</Link>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-muted-foreground mb-4">No tenants assigned to this property</p>
                <Button asChild>
                  <Link href="/dashboard/tenants/new">Add Tenant</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {(property.description || (property.amenities && property.amenities.length > 0)) && (
        <div className="grid gap-6 md:grid-cols-2">
          {property.description && (
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">{property.description}</p>
              </CardContent>
            </Card>
          )}

          {property.amenities && property.amenities.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Amenities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {property.amenities.map((amenity: string, index: number) => (
                    <Badge key={index} variant="secondary">
                      {amenity}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <PropertyPhotoGallery propertyId={params.id} />
    </div>
  )
}
