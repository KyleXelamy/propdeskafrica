"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertTriangle,
  CalendarClock,
  Wrench,
  DollarSign,
  StickyNote,
  ArrowRight,
  Activity,
} from "lucide-react"
import { formatCurrency, formatDate, tenantName } from "@/lib/utils"

type ActivityItem = {
  type: "payment" | "expense" | "maintenance" | "note"
  id: string
  timestamp: string
  title: string
  subtitle: string
  href: string
  badge?: string
  badgeTone?: "default" | "success" | "warning" | "destructive" | "muted"
  amount?: number
}

type LeaseAlert = {
  tenant_id: string
  tenant_name: string
  tenant_email?: string | null
  tenant_phone?: string | null
  property_id: string | null
  property_name: string
  lease_end_date: string
  days_until_expiry: number
  severity: "expired" | "critical" | "warning" | "upcoming"
}

export function LeaseExpiryAlerts() {
  const [items, setItems] = useState<LeaseAlert[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/dashboard/leases")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed to load")
        return r.json()
      })
      .then((d) => { if (!cancelled) setItems(d) })
      .catch((e) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading) return <Skeleton className="h-64 w-full" />
  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <CalendarClock className="h-4 w-4" />
          Lease Expiry Alerts
        </CardTitle>
        <CardDescription className="text-sm">Leases ending in the next 60 days</CardDescription>
      </CardHeader>
      <CardContent>
        {!items || items.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">
            No leases expiring soon.
          </div>
        ) : (
          <div className="space-y-3">
            {items.slice(0, 5).map((lease) => {
              const sev =
                lease.severity === "expired" ? "destructive"
                : lease.severity === "critical" ? "destructive"
                : lease.severity === "warning" ? "secondary"
                : "outline"
              return (
                <Link
                  key={lease.tenant_id}
                  href={lease.property_id ? `/dashboard/properties/${lease.property_id}` : "/dashboard/tenants"}
                  className="flex items-center justify-between gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{lease.tenant_name}</div>
                    <div className="text-xs text-muted-foreground truncate">{lease.property_name}</div>
                  </div>
                  <Badge variant={sev as any} className="shrink-0">
                    {lease.severity === "expired"
                      ? `Expired ${Math.abs(lease.days_until_expiry)}d ago`
                      : lease.days_until_expiry === 0
                        ? "Expires today"
                        : `${lease.days_until_expiry}d left`}
                  </Badge>
                </Link>
              )
            })}
            {items.length > 5 && (
              <Link
                href="/dashboard/tenants"
                className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-primary pt-2"
              >
                See all {items.length} leases expiring
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const typeIcons = {
  payment: DollarSign,
  expense: DollarSign,
  maintenance: Wrench,
  note: StickyNote,
}

const toneClasses: Record<string, string> = {
  default: "bg-secondary text-secondary-foreground",
  success: "bg-chart-4 text-white",
  warning: "bg-chart-2 text-white",
  destructive: "bg-destructive text-destructive-foreground",
  muted: "bg-muted text-muted-foreground",
}

export function ActivityFeed() {
  const [items, setItems] = useState<ActivityItem[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch("/api/dashboard/activity")
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed")
        return r.json()
      })
      .then((d) => { if (!cancelled) setItems(d) })
      .catch(() => { if (!cancelled) setItems([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Recent Activity
        </CardTitle>
        <CardDescription className="text-sm">Across payments, expenses, maintenance, and notes</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : !items || items.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">
            No recent activity. Start by adding properties and tenants.
          </div>
        ) : (
          <div className="space-y-2">
            {items.slice(0, 8).map((item) => {
              const Icon = typeIcons[item.type] || Activity
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div className={`p-1.5 rounded-md shrink-0 ${toneClasses[item.badgeTone || "muted"]}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{item.title}</span>
                      {item.amount !== undefined && (
                        <span className={`text-xs font-medium tabular-nums ${item.amount < 0 ? "text-destructive" : "text-chart-4"}`}>
                          {formatCurrency(Math.abs(item.amount))}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatDate(item.timestamp)}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
