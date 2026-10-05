import { ExpenseForm } from "@/components/expense-form"

export default function NewExpensePage() {
  return (
    <div className="space-y-6 pt-2 md:pt-0">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Add New Expense</h1>
        <p className="text-sm md:text-base text-muted-foreground">Record a property-related expense</p>
      </div>

      <ExpenseForm />
    </div>
  )
}
