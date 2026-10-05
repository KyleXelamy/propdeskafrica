"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts"
import { useEffect, useState } from "react"

interface ReportsData {
  period: { month: string; previousMonth: string }
  financial: {
    current: { rentCollected: number; expenses: number; netIncome: number }
    previous: { rentCollected: number; expenses: number; netIncome: number }
    change: { rentPct: number; expensePct: number; netIncomePct: number }
    byCategory: Record<string, number>
  }
  trend: { month: string; payments: number; expenses: number; net: number }[]
  properties: { total: number; occupied: number; occupancyRate: number }
  tenants: { active: number }
  maintenance: { open: number; urgent: number }
}

const COLORS = ["#7c3aed", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#ec4899", "#8b5cf6", "#14b8a6"]

export function ReportCharts() {
  const [data, setData] = useState<ReportsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/reports")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed to load")
        return r.json()
      })
      .then((d) => { if (!cancelled) setData(d) })
      .catch((e) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-56 w-full md:col-span-2" />
      </div>
    )
  }
  if (error || !data) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="pt-6 text-sm text-destructive">
          {error || "Couldn't load charts."}
        </CardContent>
      </Card>
    )
  }

  const comparison = [
    { name: "Rent", current: data.financial.current.rentCollected, previous: data.financial.previous.rentCollected },
    { name: "Expenses", current: data.financial.current.expenses, previous: data.financial.previous.expenses },
    { name: "Net Income", current: data.financial.current.netIncome, previous: data.financial.previous.netIncome },
  ]

  const expenseByCategory = Object.entries(data.financial.byCategory)
    .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }))
    .sort((a, b) => b.value - a.value)

  // cumulative net cash flow for the trend line
  let running = 0
  const cumulative = (data.trend || []).map((p) => {
    running += p.net
    return { month: p.month, cumulative: running }
  })

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Month-over-Month Comparison</CardTitle>
            <CardDescription className="text-sm">Current vs. previous month (KSH)</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparison} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => `KSH ${v.toLocaleString()}`}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="previous" name="Last month" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="current" name="This month" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Expenses by Category</CardTitle>
            <CardDescription className="text-sm">Where the money goes this month</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {expenseByCategory.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                No expenses recorded this month.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseByCategory}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={40}
                    paddingAngle={2}
                  >
                    {expenseByCategory.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => `KSH ${v.toLocaleString()}`}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {cumulative.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Net Cash Flow Trend</span>
              <span className={`text-sm tabular-nums ${running >= 0 ? "text-chart-4" : "text-destructive"}`}>
                {running >= 0 ? "+" : ""}KSH {running.toLocaleString()} (last 6 mo)
              </span>
            </CardTitle>
            <CardDescription className="text-sm">Cumulative net cash flow (income − expenses)</CardDescription>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cumulative} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => `KSH ${v.toLocaleString()}`}
                />
                <Line
                  type="monotone"
                  dataKey="cumulative"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
