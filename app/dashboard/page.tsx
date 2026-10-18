"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Building2, Users, DollarSign, AlertTriangle, Loader2, Upload, ArrowRight, Plus, ShieldCheck, WalletCards } from "lucide-react"
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
        console.error("[propdeskafrica] dashboard error", e)
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
    <div className="space-y-5 pb-8 pt-2 md:space-y-7 md:pt-0">
      <section className="relative overflow-hidden rounded-2xl border border-primary/15 bg-primary px-5 py-6 text-primary-foreground shadow-sm md:px-7 md:py-8">
        <div className="absolute -right-16 -top-24 size-64 rounded-full border border-secondary/25" />
        <div className="absolute -right-4 -top-12 size-44 rounded-full border border-secondary/15" />
        <div className="relative max-w-2xl">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-secondary">Operations command center</p>
          <h1 className="max-w-xl text-2xl font-semibold tracking-[-0.03em] md:text-4xl">Know what needs attention before it becomes expensive.</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-primary-foreground/75 md:text-base">A single operating view for your portfolio, cash movement, tenant commitments, and service delivery.</p>
        </div>
        <div className="relative mt-6 flex flex-wrap gap-2">
          <Button asChild size="sm" className="bg-secondary text-secondary-foreground hover:bg-secondary/90"><Link href="/dashboard/finances/payments/new"><Plus data-icon="inline-start" />Record transaction</Link></Button>
          <Button asChild size="sm" variant="outline" className="border-primary-foreground/25 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"><Link href="/dashboard/reports">Review portfolio <ArrowRight data-icon="inline-end" /></Link></Button>
        </div>
      </section>

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
              <Card className="h-full cursor-pointer border-border/80 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md focus-within:ring-2 focus-within:ring-ring">
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

      {!loading && stats?.properties === 0 && (
        <Card className="border-primary/20 bg-primary/[0.03]">
          <CardHeader>
            <CardTitle className="text-lg md:text-xl">Set up your first property</CardTitle>
            <CardDescription>Start your 14-day PropDesk Africa trial by adding a property or importing your portfolio.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 sm:flex-row">
            <Button asChild><Link href="/dashboard/properties/new"><Building2 className="mr-2 h-4 w-4" />Add your first property<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            <Button asChild variant="outline"><Link href="/dashboard/properties"><Upload className="mr-2 h-4 w-4" />Import a CSV</Link></Button>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/80">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg md:text-xl">Next best actions</CardTitle>
            <CardDescription className="text-sm">Keep the operating rhythm moving.</CardDescription>
          </div>
          <span className="hidden rounded-full border border-secondary/30 bg-secondary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-secondary-foreground sm:inline-flex">Today</span>
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

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/80 md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="size-4 text-secondary" />Portfolio posture</CardTitle>
            <CardDescription>Signals that help you prioritize the next decision.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Link href="/dashboard/reconciliation" className="rounded-xl border border-border/80 p-4 transition-colors hover:border-primary/30 hover:bg-accent/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Cash control</p>
              <p className="mt-2 text-sm font-medium">Reconcile incoming payments</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Keep every movement matched to the right tenant and property.</p>
            </Link>
            <Link href="/dashboard/reports" className="rounded-xl border border-border/80 p-4 transition-colors hover:border-primary/30 hover:bg-accent/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Portfolio review</p>
              <p className="mt-2 text-sm font-medium">Prepare the monthly review</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Turn live records into an owner-ready view of performance.</p>
            </Link>
          </CardContent>
        </Card>
        <Card className="border-border/80 bg-accent/30">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><WalletCards className="size-4 text-secondary" />Control desk</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Every payment, expense, work order, and lease event should have a clear owner and next action.</p>
            <Link href="/dashboard/finances" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">Open finance desk <ArrowRight className="size-3.5" /></Link>
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <ActivityFeed />
        <LeaseExpiryAlerts />
      </div>
    </div>
  )
}
