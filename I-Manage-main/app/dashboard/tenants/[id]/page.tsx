"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Edit, Mail, Phone, MapPin, Calendar, AlertTriangle, Loader2 } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { DeleteButton } from "@/components/delete-button"
import { TenantInviteCard } from "@/components/tenant-invite-card"
import { MpesaPayButton } from "@/components/mpesa-pay-button"
import { formatCurrency, formatDate, tenantName } from "@/lib/utils"

export default function TenantPage() {
  const params = useParams<{ id: string }>()
  const [tenant, setTenant] = useState<any>(null)
  const [link, setLink] = useState<any>(null)
  const [recentPayments, setRecentPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!params?.id) return
    const fetchData = async () => {
      try {
        const supabase = createClient()
        const [tenantRes, paymentsRes, linkRes] = await Promise.all([
          supabase
            .from("tenants")
            .select(`
              *,
              properties (id, name, address, rent_amount, monthly_rent)
            `)
            .eq("id", params.id)
            .maybeSingle(),
          supabase
            .from("rent_payments")
            .select("*")
            .eq("tenant_id", params.id)
            .order("due_date", { ascending: false })
            .limit(5),
          supabase
            .from("tenant_users")
            .select("id, user_id, tenant_id")
            .eq("tenant_id", params.id)
            .maybeSingle(),
        ])
        if (tenantRes.error) throw tenantRes.error
        if (!tenantRes.data) setNotFound(true)
        else setTenant(tenantRes.data)
        setRecentPayments(paymentsRes.data || [])
        setLink(linkRes.data)
      } catch (error) {
        console.error("[i-manage] fetch tenant error", error)
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
  if (notFound || !tenant) {
    return (
      <div className="text-center py-10 space-y-4">
        <p className="text-muted-foreground">Tenant not found</p>
        <Button asChild variant="outline"><Link href="/dashboard/tenants">Back to Tenants</Link></Button>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-chart-4 text-white"
      case "inactive": return "bg-muted text-muted-foreground"
      case "pending": return "bg-secondary text-secondary-foreground"
      default: return "bg-muted text-muted-foreground"
    }
  }

  const isLeaseExpiringSoon = () => {
    if (!tenant.lease_end_date) return false
    const endDate = new Date(tenant.lease_end_date)
    const today = new Date()
    const daysUntilExpiry = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0
  }

  const rent = tenant.monthly_rent

  return (
    <div className="space-y-6 pt-2 md:pt-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">{tenantName(tenant)}</h1>
          {tenant.properties && (
            <div className="flex items-center text-muted-foreground mt-1 text-sm md:text-base">
              <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
              <span>{tenant.properties.name}</span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={getStatusColor(tenant.status)}>{tenant.status}</Badge>
          {isLeaseExpiringSoon() && (
            <Badge className="bg-destructive text-destructive-foreground">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Lease Expiring Soon
            </Badge>
          )}
          <Button asChild size="sm">
            <Link href={`/dashboard/tenants/${tenant.id}/edit`}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Link>
          </Button>
          <MpesaPayButton
            tenantId={tenant.id}
            defaultAmount={Number(tenant.monthly_rent || 0)}
            defaultPhone={tenant.phone || undefined}
          />
          <DeleteButton
            endpoint={`/api/tenants/${tenant.id}`}
            resource="tenant"
            redirectTo="/dashboard/tenants"
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Full Name:</span>
                <span className="font-medium">{tenantName(tenant)}</span>
              </div>
              {tenant.email && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Email:</span>
                  <div className="flex items-center min-w-0">
                    <Mail className="h-4 w-4 mr-1 flex-shrink-0" />
                    <a href={`mailto:${tenant.email}`} className="text-primary hover:underline truncate">{tenant.email}</a>
                  </div>
                </div>
              )}
              {tenant.phone && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone:</span>
                  <div className="flex items-center">
                    <Phone className="h-4 w-4 mr-1" />
                    <a href={`tel:${tenant.phone}`} className="text-primary hover:underline">{tenant.phone}</a>
                  </div>
                </div>
              )}
              {tenant.national_id && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">National ID:</span>
                  <span className="font-medium">{tenant.national_id}</span>
                </div>
              )}
              {(tenant.emergency_contact_name || tenant.emergency_contact_phone) && (
                <>
                  <Separator />
                  {tenant.emergency_contact_name && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Emergency Contact:</span>
                      <span className="font-medium">{tenant.emergency_contact_name}</span>
                    </div>
                  )}
                  {tenant.emergency_contact_phone && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Emergency Phone:</span>
                      <div className="flex items-center">
                        <Phone className="h-4 w-4 mr-1" />
                        <a href={`tel:${tenant.emergency_contact_phone}`} className="text-primary hover:underline">
                          {tenant.emergency_contact_phone}
                        </a>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lease Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              {tenant.properties && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Property:</span>
                  <div className="text-right">
                    <div className="font-medium">{tenant.properties.name}</div>
                    <div className="text-sm text-muted-foreground">{tenant.properties.address}</div>
                  </div>
                </div>
              )}
              {tenant.lease_start_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Lease Start:</span>
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    {formatDate(tenant.lease_start_date)}
                  </div>
                </div>
              )}
              {tenant.lease_end_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Lease End:</span>
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    {formatDate(tenant.lease_end_date)}
                  </div>
                </div>
              )}
              {rent != null && rent !== "" && (
                <>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Monthly Rent:</span>
                    <span className="font-medium text-primary">{formatCurrency(rent)}</span>
                  </div>
                </>
              )}
              {tenant.deposit_amount && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Deposit:</span>
                  <span className="font-medium">{formatCurrency(tenant.deposit_amount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tenant Since:</span>
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-1" />
                  {formatDate(tenant.created_at)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Rent Payments</CardTitle>
          <CardDescription>
            {recentPayments && recentPayments.length > 0
              ? `Last ${recentPayments.length} payment(s)`
              : "No payment history"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentPayments && recentPayments.length > 0 ? (
            <div className="space-y-3">
              {recentPayments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between p-3 border rounded-lg gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{formatCurrency(payment.amount)}</div>
                    <div className="text-sm text-muted-foreground">Due: {formatDate(payment.due_date)}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <Badge
                      className={
                        payment.status === "paid" || payment.status === "completed"
                          ? "bg-chart-4 text-white"
                          : payment.status === "late"
                            ? "bg-destructive text-destructive-foreground"
                            : "bg-secondary text-secondary-foreground"
                      }
                    >
                      {payment.status}
                    </Badge>
                    {payment.paid_date && (
                      <div className="text-sm text-muted-foreground mt-1">Paid: {formatDate(payment.paid_date)}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-muted-foreground mb-4">No payment history available</p>
              <Button asChild>
                <Link href="/dashboard/finances">Manage Payments</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {tenant.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">{tenant.notes}</p>
          </CardContent>
        </Card>
      )}

      <TenantInviteCard
        tenantId={tenant.id}
        tenantEmail={tenant.email}
        initiallyLinked={Boolean((link as any)?.tenant_id)}
      />
    </div>
  )
}
