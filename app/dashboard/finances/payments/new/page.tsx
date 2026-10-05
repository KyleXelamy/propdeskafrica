import { PaymentForm } from "@/components/payment-form"

export default function NewPaymentPage() {
  return (
    <div className="space-y-6 pt-2 md:pt-0">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Record Rent Payment</h1>
        <p className="text-sm md:text-base text-muted-foreground">Add a new rent payment record</p>
      </div>

      <PaymentForm />
    </div>
  )
}
