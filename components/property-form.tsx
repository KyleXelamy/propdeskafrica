"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle } from "lucide-react"
import { apiFetch, ApiError } from "@/lib/api/client"

interface PropertyFormProps {
  property?: any
  isEditing?: boolean
}

export function PropertyForm({ property, isEditing = false }: PropertyFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: property?.name || "",
    address: property?.address || "",
    city: property?.city || "",
    county: property?.county || "",
    type: property?.type || "",
    bedrooms: property?.bedrooms || "",
    bathrooms: property?.bathrooms || "",
    rent_amount: property?.rent_amount || "",
    deposit_amount: property?.deposit_amount || "",
    status: property?.status || "vacant",
    description: property?.description || "",
    amenities: property?.amenities?.join(", ") || "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const propertyData = {
        name: formData.name,
        address: formData.address,
        city: formData.city || "Nairobi",
        county: formData.county || "Nairobi",
        type: formData.type,
        bedrooms: formData.bedrooms ? Number.parseInt(formData.bedrooms) : null,
        bathrooms: formData.bathrooms ? Number.parseFloat(formData.bathrooms) : null,
        rent_amount: formData.rent_amount ? Number.parseFloat(formData.rent_amount) : 0,
        deposit_amount: formData.deposit_amount ? Number.parseFloat(formData.deposit_amount) : null,
        status: formData.status,
        description: formData.description || null,
        amenities: formData.amenities
          ? formData.amenities.split(",").map((item) => item.trim()).filter(Boolean)
          : [],
      }

      const url = isEditing && property
        ? `/api/properties/${property.id}`
        : "/api/properties"
      const method = isEditing && property ? "PUT" : "POST"

      await apiFetch(url, { method, body: propertyData })

      router.push("/dashboard/properties")
      router.refresh()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Please try again."
      setError(`Error saving property: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{isEditing ? "Edit Property" : "Property Information"}</CardTitle>
        <CardDescription>
          {isEditing ? "Update the property details" : "Fill in the details for your rental property"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Property Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="e.g., Sunset Apartments Unit 1A"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Property Type *</Label>
              <Select value={formData.type} onValueChange={(value) => handleChange("type", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="apartment">Apartment</SelectItem>
                  <SelectItem value="house">House</SelectItem>
                  <SelectItem value="maisonette">Maisonette</SelectItem>
                  <SelectItem value="bedsitter">Bedsitter</SelectItem>
                  <SelectItem value="studio">Studio</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="land">Land/Plot</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address *</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => handleChange("address", e.target.value)}
              placeholder="Full property address"
              required
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => handleChange("city", e.target.value)}
                placeholder="e.g., Nairobi"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="county">County</Label>
              <Input
                id="county"
                value={formData.county}
                onChange={(e) => handleChange("county", e.target.value)}
                placeholder="e.g., Nairobi"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bedrooms">Bedrooms</Label>
              <Input
                id="bedrooms"
                type="number"
                value={formData.bedrooms}
                onChange={(e) => handleChange("bedrooms", e.target.value)}
                placeholder="0"
                min="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bathrooms">Bathrooms</Label>
              <Input
                id="bathrooms"
                type="number"
                step="0.5"
                value={formData.bathrooms}
                onChange={(e) => handleChange("bathrooms", e.target.value)}
                placeholder="0"
                min="0"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rent_amount">Monthly Rent (KSH) *</Label>
              <Input
                id="rent_amount"
                type="number"
                step="0.01"
                value={formData.rent_amount}
                onChange={(e) => handleChange("rent_amount", e.target.value)}
                placeholder="0.00"
                min="0"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deposit_amount">Security Deposit (KSH)</Label>
              <Input
                id="deposit_amount"
                type="number"
                step="0.01"
                value={formData.deposit_amount}
                onChange={(e) => handleChange("deposit_amount", e.target.value)}
                placeholder="0.00"
                min="0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value) => handleChange("status", value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vacant">Vacant</SelectItem>
                <SelectItem value="occupied">Occupied</SelectItem>
                <SelectItem value="maintenance">Under Maintenance</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amenities">Amenities</Label>
            <Input
              id="amenities"
              value={formData.amenities}
              onChange={(e) => handleChange("amenities", e.target.value)}
              placeholder="e.g., Pool, Gym, Parking, Laundry (comma separated)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="Additional details about the property..."
              rows={4}
            />
          </div>

          <div className="flex gap-4">
            <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditing ? "Updating..." : "Creating..."}
                </>
              ) : (
                <>{isEditing ? "Update Property" : "Create Property"}</>
              )}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
