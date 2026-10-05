"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Users, Mail, Phone, MapPin, Loader2, Search } from "lucide-react"
import { EmptyState } from "@/components/empty-state"
import { SearchInput } from "@/components/search-input"
import Link from "next/link"
import { formatKenyaCurrency, formatDate, tenantName } from "@/lib/utils"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export default function TenantsPage() {
  const [tenants, setTenants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")

  const filtered = query.trim()
    ? tenants.filter((t) => {
        const q = query.toLowerCase()
        const name = (t.full_name || `${t.first_name || ""} ${t.last_name || ""}`).toLowerCase()
        return (
          name.includes(q) ||
          t.email?.toLowerCase().includes(q) ||
          t.phone?.toLowerCase().includes(q) ||
          t.national_id?.toLowerCase().includes(q) ||
          t.properties?.name?.toLowerCase().includes(q)
        )
      })
    : tenants

  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("tenants")
          .select(`
            *,
            properties (
              name,
              address
            )
          `)
          .order("created_at", { ascending: false })

        if (error) throw error
        setTenants(data || [])
      } catch (err: any) {
        console.error("[i-manage] fetch tenants error", err)
        setError(err.message || "Failed to load tenants")
      } finally {
        setLoading(false)
      }
    }

    fetchTenants()
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-chart-4 text-white"
      case "inactive":
        return "bg-muted text-muted-foreground"
      case "pending":
        return "bg-secondary text-secondary-foreground"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  return (
    <div className="space-y-6 pt-2 md:pt-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Tenants</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            {tenants.length === 0
              ? "Manage your rental tenants"
              : `${filtered.length} of ${tenants.length} tenants`}
          </p>
        </div>
        <Button asChild className="bg-primary hover:bg-primary/90 w-full sm:w-auto">
          <Link href="/dashboard/tenants/new">
            <Plus className="h-4 w-4 mr-2" />
            Add Tenant
          </Link>
        </Button>
      </div>

      {tenants.length > 0 && (
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search by name, email, phone, property…"
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
      ) : !tenants || tenants.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No tenants yet"
          description="Add your first tenant to start tracking leases, payments, and contact info."
          action={{ label: "Add Your First Tenant", href: "/dashboard/tenants/new" }}
        />
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="text-center py-10">
            <Search className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              No tenants match &ldquo;<span className="font-medium text-foreground">{query}</span>&rdquo;.
            </p>
            <Button variant="outline" className="mt-3 bg-transparent" onClick={() => setQuery("")}>
              Clear search
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tenant) => {
            const rent = tenant.monthly_rent
            return (
              <Card key={tenant.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{tenantName(tenant)}</CardTitle>
                      {tenant.properties && (
                        <div className="flex items-center text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3 mr-1" />
                          {tenant.properties.name}
                        </div>
                      )}
                    </div>
                    <Badge className={getStatusColor(tenant.status)}>{tenant.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {tenant.email && (
                    <div className="flex items-center text-sm">
                      <Mail className="h-3 w-3 mr-2 text-muted-foreground" />
                      <span className="truncate">{tenant.email}</span>
                    </div>
                  )}

                  {tenant.phone && (
                    <div className="flex items-center text-sm">
                      <Phone className="h-3 w-3 mr-2 text-muted-foreground" />
                      <span>{tenant.phone}</span>
                    </div>
                  )}

                  {rent != null && rent !== "" && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Monthly Rent:</span>
                      <span className="font-medium text-primary">{formatKenyaCurrency(rent)}</span>
                    </div>
                  )}

                  {tenant.lease_start_date && tenant.lease_end_date && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Lease Start:</span>
                        <span className="text-sm">{formatDate(tenant.lease_start_date)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Lease End:</span>
                        <span className="text-sm">{formatDate(tenant.lease_end_date)}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" asChild className="flex-1 bg-transparent">
                      <Link href={`/dashboard/tenants/${tenant.id}`}>View Details</Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild className="flex-1 bg-transparent">
                      <Link href={`/dashboard/tenants/${tenant.id}/edit`}>Edit</Link>
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
