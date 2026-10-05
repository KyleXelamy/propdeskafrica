"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { apiFetch, ApiError } from "@/lib/api/client"

interface TenantFormProps {
  tenant?: any
  isEditing?: boolean
}

export function TenantForm({ tenant, isEditing = false }: TenantFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [properties, setProperties] = useState<any[]>([])
  const [formData, setFormData] = useState({
    first_name: tenant?.first_name || "",
    last_name: tenant?.last_name || "",
    email: tenant?.email || "",
    phone: tenant?.phone || "",
    property_id: tenant?.property_id || "",
    emergency_contact_name: tenant?.emergency_contact_name || "",
    emergency_contact_phone: tenant?.emergency_contact_phone || "",
    lease_start_date: tenant?.lease_start_date || "",
    lease_end_date: tenant?.lease_end_date || "",
    monthly_rent: tenant?.monthly_rent || "",
    deposit_paid: tenant?.deposit_paid || "",
    status: tenant?.status || "active",
    notes: tenant?.notes || "",
  })

  // Fetch properties for the dropdown (read-only — uses anon-safe select)
  useEffect(() => {
    const fetchProperties = async () => {
      const supabase = createClient()
      const { data, error } = await supabase.from("properties").select("id, name, address").order("name")
      if (error) {
        console.error("[i-manage] fetch properties error", error)
      } else {
        setProperties(data || [])
      }
    }
    fetchProperties()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const fullName = [formData.first_name, formData.last_name].filter(Boolean).join(" ") || null
      const tenantData = {
        full_name: fullName,
        first_name: formData.first_name || null,
        last_name: formData.last_name || null,
        email: formData.email || null,
        phone: formData.phone,
        property_id: formData.property_id || null,
        emergency_contact_name: formData.emergency_contact_name || null,
        emergency_contact_phone: formData.emergency_contact_phone || null,
        lease_start_date: formData.lease_start_date || null,
        lease_end_date: formData.lease_end_date || null,
        monthly_rent: formData.monthly_rent ? Number.parseFloat(formData.monthly_rent) : null,
        // `deposit_paid` is the legacy alias; the API also accepts deposit_amount.
        deposit_amount: formData.deposit_paid ? Number.parseFloat(formData.deposit_paid) : null,
        status: formData.status,
        notes: formData.notes || null,
      }

      const url = isEditing && tenant ? `/api/tenants/${tenant.id}` : "/api/tenants"
      const method = isEditing && tenant ? "PUT" : "POST"
      await apiFetch(url, { method, body: tenantData })

      router.push("/dashboard/tenants")
      router.refresh()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Please try again."
      setError(`Error saving tenant: ${msg}`)
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
        <CardTitle>{isEditing ? "Edit Tenant" : "Tenant Information"}</CardTitle>
        <CardDescription>
          {isEditing ? "Update the tenant details" : "Fill in the details for your new tenant"}
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
              <Label htmlFor="first_name">First Name *</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => handleChange("first_name", e.target.value)}
                placeholder="John"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name *</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => handleChange("last_name", e.target.value)}
                placeholder="Doe"
                required
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="john.doe@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="property_id">Property</Label>
            <Select value={formData.property_id} onValueChange={(value) => handleChange("property_id", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a property" />
              </SelectTrigger>
              <SelectContent>
                {properties.map((property) => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.name} - {property.address}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="emergency_contact_name">Emergency Contact Name</Label>
              <Input
                id="emergency_contact_name"
                value={formData.emergency_contact_name}
                onChange={(e) => handleChange("emergency_contact_name", e.target.value)}
                placeholder="Jane Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emergency_contact_phone">Emergency Contact Phone</Label>
              <Input
                id="emergency_contact_phone"
                value={formData.emergency_contact_phone}
                onChange={(e) => handleChange("emergency_contact_phone", e.target.value)}
                placeholder="(555) 987-6543"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lease_start_date">Lease Start Date</Label>
              <Input
                id="lease_start_date"
                type="date"
                value={formData.lease_start_date}
                onChange={(e) => handleChange("lease_start_date", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lease_end_date">Lease End Date</Label>
              <Input
                id="lease_end_date"
                type="date"
                value={formData.lease_end_date}
                onChange={(e) => handleChange("lease_end_date", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="monthly_rent">Monthly Rent ($)</Label>
              <Input
                id="monthly_rent"
                type="number"
                step="0.01"
                value={formData.monthly_rent}
                onChange={(e) => handleChange("monthly_rent", e.target.value)}
                placeholder="0.00"
                min="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deposit_paid">Deposit Paid ($)</Label>
              <Input
                id="deposit_paid"
                type="number"
                step="0.01"
                value={formData.deposit_paid}
                onChange={(e) => handleChange("deposit_paid", e.target.value)}
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
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="Additional notes about the tenant..."
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
                <>{isEditing ? "Update Tenant" : "Create Tenant"}</>
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
