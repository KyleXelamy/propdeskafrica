"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, DollarSign, TrendingUp, TrendingDown, Loader2, Repeat } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency, formatDate, tenantName } from "@/lib/utils"
import { RecurringExpensesPanel } from "@/components/recurring-expenses-panel"

export default function FinancesPage() {
  const [rentPayments, setRentPayments] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchFinancialData = async () => {
      try {
        const supabase = createClient()
        const currentMonth = new Date()
        const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
        const lastDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59)

        const [paymentsRes, expensesRes] = await Promise.all([
          supabase
            .from("rent_payments")
            .select(`
              *,
              tenants (full_name, first_name, last_name),
              properties (name)
            `)
            .gte("due_date", firstDayOfMonth.toISOString())
            .lte("due_date", lastDayOfMonth.toISOString())
            .order("due_date", { ascending: false }),
          supabase
            .from("expenses")
            .select("*, properties(name)")
            .gte("expense_date", firstDayOfMonth.toISOString())
            .lte("expense_date", lastDayOfMonth.toISOString())
            .order("expense_date", { ascending: false }),
        ])

        if (paymentsRes.error) throw paymentsRes.error
        if (expensesRes.error) throw expensesRes.error

        setRentPayments(paymentsRes.data || [])
        setExpenses(expensesRes.data || [])
      } catch (err: any) {
        console.error("[i-manage] fetch finances error", err)
        setError(err.message || "Failed to load financial data")
      } finally {
        setLoading(false)
      }
    }
    fetchFinancialData()
  }, [])

  const totalRentDue = rentPayments?.reduce((sum, payment) => sum + Number(payment.amount || 0), 0) || 0
  const totalRentPaid =
    rentPayments?.filter((p) => p.status === "paid" || p.status === "completed")
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0) || 0
  const totalExpenses = expenses?.reduce((sum, expense) => sum + Number(expense.amount || 0), 0) || 0
  const netIncome = totalRentPaid - totalExpenses

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case "paid":
      case "completed":
        return "bg-chart-4 text-white"
      case "late":
        return "bg-destructive text-destructive-foreground"
      case "partial":
        return "bg-secondary text-secondary-foreground"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  return (
    <div className="space-y-6 pt-2 md:pt-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Finances</h1>
          <p className="text-sm md:text-base text-muted-foreground">Track rent payments, expenses, and financial reports</p>
        </div>
        <div className="flex gap-2 flex-col sm:flex-row w-full sm:w-auto">
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/dashboard/finances/payments/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Payment
            </Link>
          </Button>
          <Button asChild className="bg-primary hover:bg-primary/90 w-full sm:w-auto">
            <Link href="/dashboard/finances/expenses/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Link>
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Rent Due This Month</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatCurrency(totalRentDue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Rent Collected</CardTitle>
            <TrendingUp className="h-4 w-4 text-chart-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-chart-4">{formatCurrency(totalRentPaid)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{formatCurrency(totalExpenses)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Income</CardTitle>
            <DollarSign className={`h-4 w-4 ${netIncome >= 0 ? "text-chart-4" : "text-destructive"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netIncome >= 0 ? "text-chart-4" : "text-destructive"}`}>
              {formatCurrency(netIncome)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="payments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="payments">Rent Payments</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="recurring">Recurring</TabsTrigger>
        </TabsList>

        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Rent Payments</CardTitle>
              <CardDescription>Current month rent payment status</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : rentPayments && rentPayments.length > 0 ? (
                <div className="space-y-3">
                  {rentPayments.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg gap-3">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="font-medium truncate">{tenantName(payment.tenants)}</div>
                        <div className="text-sm text-muted-foreground truncate">
                          {payment.properties?.name} • Due: {formatDate(payment.due_date)}
                        </div>
                      </div>
                      <div className="text-right space-y-1 flex-shrink-0">
                        <div className="font-medium">{formatCurrency(payment.amount)}</div>
                        <Badge className={getPaymentStatusColor(payment.status)}>{payment.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No rent payments recorded for this month</p>
                  <Button asChild>
                    <Link href="/dashboard/finances/payments/new">
                      <Plus className="h-4 w-4 mr-2" />
                      Record Payment
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Expenses</CardTitle>
              <CardDescription>Current month property expenses</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : expenses && expenses.length > 0 ? (
                <div className="space-y-3">
                  {expenses.map((expense) => (
                    <div key={expense.id} className="flex items-center justify-between p-4 border rounded-lg gap-3">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="font-medium flex items-center gap-2">
                          <span className="truncate">{expense.description}</span>
                          {expense.is_recurring && (
                            <Badge variant="secondary" className="gap-1 text-xs flex-shrink-0">
                              <Repeat className="h-3 w-3" />
                              {expense.recurring_frequency}
                            </Badge>
                          )}
                          {expense.parent_recurring_id && (
                            <Badge variant="outline" className="text-xs flex-shrink-0">generated</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          {expense.category} • {expense.properties?.name || "General"} • {formatDate(expense.expense_date)}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-medium text-destructive">{formatCurrency(expense.amount)}</div>
                        {expense.vendor && <div className="text-sm text-muted-foreground">{expense.vendor}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No expenses recorded for this month</p>
                  <Button asChild>
                    <Link href="/dashboard/finances/expenses/new">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Expense
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recurring" className="space-y-4">
          <RecurringExpensesPanel
            templates={(expenses || [])
              .filter((e: any) => e.is_recurring)
              .map((e: any) => ({
                id: e.id,
                description: e.description || e.category,
                category: e.category,
                amount: Number(e.amount || 0),
                vendor: e.vendor,
                recurring_frequency: e.recurring_frequency,
                next_occurrence: e.next_occurrence,
                property_name: e.properties?.name || null,
              }))}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
