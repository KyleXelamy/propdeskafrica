"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Edit, MapPin, Calendar, Phone, AlertTriangle, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { DeleteButton } from "@/components/delete-button"
import { formatCurrency, formatDate, tenantName } from "@/lib/utils"

export default function MaintenancePage() {
  const params = useParams<{ id: string }>()
  const [maintenanceRequest, setMaintenanceRequest] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!params?.id) return
    const fetchRequest = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("maintenance_requests")
          .select(`
            *,
            properties (id, name, address),
            tenants (id, full_name, first_name, last_name, email, phone)
          `)
          .eq("id", params.id)
          .maybeSingle()
        if (error) throw error
        if (!data) setNotFound(true)
        else setMaintenanceRequest(data)
      } catch (error) {
        console.error("[i-manage] fetch maintenance error", error)
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    fetchRequest()
  }, [params?.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (notFound || !maintenanceRequest) {
    return (
      <div className="text-center py-10 space-y-4">
        <p className="text-muted-foreground">Maintenance request not found</p>
        <Button asChild variant="outline">
          <Link href="/dashboard/maintenance">Back to Maintenance</Link>
        </Button>
      </div>
    )
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-destructive text-destructive-foreground"
      case "high": return "bg-secondary text-secondary-foreground"
      case "medium": return "bg-chart-2 text-white"
      case "low": return "bg-muted text-muted-foreground"
      default: return "bg-muted text-muted-foreground"
    }
  }
  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-secondary text-secondary-foreground"
      case "in_progress": return "bg-chart-2 text-white"
      case "completed": return "bg-chart-4 text-white"
      case "cancelled": return "bg-muted text-muted-foreground"
      default: return "bg-muted text-muted-foreground"
    }
  }
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "open": return <AlertTriangle className="h-4 w-4" />
      case "in_progress": return <Clock className="h-4 w-4" />
      case "completed": return <CheckCircle className="h-4 w-4" />
      case "cancelled": return <XCircle className="h-4 w-4" />
      default: return <AlertTriangle className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6 pt-2 md:pt-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">{maintenanceRequest.title}</h1>
          <div className="flex items-center text-muted-foreground mt-1 text-sm md:text-base">
            <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
            <span>{maintenanceRequest.properties?.name}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={getPriorityColor(maintenanceRequest.priority)}>
            {maintenanceRequest.priority} priority
          </Badge>
          <Badge className={getStatusColor(maintenanceRequest.status)}>
            <div className="flex items-center gap-1">
              {getStatusIcon(maintenanceRequest.status)}
              {maintenanceRequest.status.replace("_", " ")}
            </div>
          </Badge>
          <Button asChild size="sm">
            <Link href={`/dashboard/maintenance/${maintenanceRequest.id}/edit`}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Link>
          </Button>
          <DeleteButton
            endpoint={`/api/maintenance/${maintenanceRequest.id}`}
            resource="maintenance request"
            redirectTo="/dashboard/maintenance"
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Request Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Category:</span>
                <span className="font-medium capitalize">{maintenanceRequest.category || "general"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Property:</span>
                <div className="text-right">
                  <div className="font-medium">{maintenanceRequest.properties?.name}</div>
                  <div className="text-sm text-muted-foreground">{maintenanceRequest.properties?.address}</div>
                </div>
              </div>
              {maintenanceRequest.tenants && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reported by:</span>
                  <div className="text-right">
                    <div className="font-medium">{tenantName(maintenanceRequest.tenants)}</div>
                    {maintenanceRequest.tenants.email && (
                      <div className="text-sm text-muted-foreground">{maintenanceRequest.tenants.email}</div>
                    )}
                  </div>
                </div>
              )}
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created:</span>
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-1" />
                  {formatDate(maintenanceRequest.created_at)}
                </div>
              </div>
              {maintenanceRequest.scheduled_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Scheduled:</span>
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    {formatDate(maintenanceRequest.scheduled_date)}
                  </div>
                </div>
              )}
              {maintenanceRequest.completed_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Completed:</span>
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    {formatDate(maintenanceRequest.completed_date)}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cost & Contractor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              {maintenanceRequest.estimated_cost && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estimated Cost:</span>
                  <span className="font-medium text-primary">{formatCurrency(maintenanceRequest.estimated_cost)}</span>
                </div>
              )}
              {maintenanceRequest.actual_cost && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Actual Cost:</span>
                  <span className="font-medium">{formatCurrency(maintenanceRequest.actual_cost)}</span>
                </div>
              )}
              {maintenanceRequest.contractor_name && (
                <>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Contractor:</span>
                    <div className="text-right">
                      <div className="font-medium">{maintenanceRequest.contractor_name}</div>
                      {maintenanceRequest.contractor_phone && (
                        <div className="flex items-center text-sm text-muted-foreground justify-end">
                          <Phone className="h-3 w-3 mr-1" />
                          <a href={`tel:${maintenanceRequest.contractor_phone}`} className="text-primary hover:underline">
                            {maintenanceRequest.contractor_phone}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
              {!maintenanceRequest.contractor_name && !maintenanceRequest.estimated_cost && !maintenanceRequest.actual_cost && (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">No contractor or cost info yet</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground whitespace-pre-wrap">{maintenanceRequest.description}</p>
        </CardContent>
      </Card>

      {maintenanceRequest.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Additional Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">{maintenanceRequest.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
