import { MaintenanceForm } from "@/components/maintenance-form"

export default function NewMaintenancePage() {
  return (
    <div className="space-y-6 pt-2 md:pt-0">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Create Maintenance Request</h1>
        <p className="text-sm md:text-base text-muted-foreground">Report a new maintenance issue or work order</p>
      </div>

      <MaintenanceForm />
    </div>
  )
}
