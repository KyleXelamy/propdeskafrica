"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Building2, Users, DollarSign, AlertTriangle, Loader2 } from "lucide-react"
import Link from "next/link"
import { formatKenyaCurrency } from "@/lib/utils"
import { useEffect, useState } from "react"
import { LeaseExpiryAlerts, ActivityFeed } from "@/components/dashboard-widgets"

interface DashboardStats {
  properties: number
  activeTenants: number
  monthlyRevenue: number
  openMaintenance: number
  urgentMaintenance: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/dashboard")
        if (!res.ok) {
          // 401 means the user isn't signed in — middleware will redirect.
          if (res.status !== 401) {
            const data = await res.json().catch(() => ({}))
            throw new Error(data.error || "Failed to load dashboard")
          }
          return
        }
        const data = await res.json()
        setStats(data)
      } catch (e: any) {
        console.error("[i-manage] dashboard error", e)
        setError(e.message || "Failed to load stats")
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  const statCards = [
    {
      name: "Total Properties",
      value: stats?.properties ?? 0,
      icon: Building2,
      color: "text-primary",
      bgColor: "bg-primary/10",
      href: "/dashboard/properties",
    },
    {
      name: "Active Tenants",
      value: stats?.activeTenants ?? 0,
      icon: Users,
      color: "text-chart-4",
      bgColor: "bg-chart-4/10",
      href: "/dashboard/tenants",
    },
    {
      name: "Monthly Revenue",
      value: formatKenyaCurrency(stats?.monthlyRevenue ?? 0),
      icon: DollarSign,
      color: "text-secondary",
      bgColor: "bg-secondary/10",
      href: "/dashboard/finances",
    },
    {
      name: "Open Maintenance",
      value: stats?.openMaintenance ?? 0,
      icon: AlertTriangle,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
      href: "/dashboard/maintenance",
    },
  ]

  const quickActions = [
    { name: "Add Property", href: "/dashboard/properties/new", icon: Building2 },
    { name: "Add Tenant", href: "/dashboard/tenants/new", icon: Users },
    { name: "Record Payment", href: "/dashboard/finances/payments/new", icon: DollarSign },
    { name: "Add Expense", href: "/dashboard/finances/expenses/new", icon: AlertTriangle },
  ]

  return (
    <div className="space-y-4 md:space-y-6 pt-2 md:pt-0">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm md:text-base text-muted-foreground">Welcome to I-Manage Property Management</p>
      </div>

      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => (
            <Link key={stat.name} href={stat.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground truncate pr-2">
                    {stat.name}
                  </CardTitle>
                  <div className={`p-1.5 md:p-2 rounded-lg ${stat.bgColor} flex-shrink-0`}>
                    <stat.icon className={`h-3 w-3 md:h-4 md:w-4 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-lg md:text-2xl font-bold text-foreground truncate">{stat.value}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">Quick Actions</CardTitle>
          <CardDescription className="text-sm">Get started with common tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
            {quickActions.map((action) => (
              <Button
                key={action.name}
                asChild
                variant="outline"
                className="h-auto p-3 md:p-4 flex-col gap-2 bg-transparent"
              >
                <Link href={action.href}>
                  <action.icon className="h-4 w-4 md:h-5 md:w-5" />
                  <span className="text-xs md:text-sm font-medium">{action.name}</span>
                </Link>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <ActivityFeed />
        <LeaseExpiryAlerts />
      </div>
    </div>
  )
}
