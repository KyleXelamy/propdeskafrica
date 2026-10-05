import { TenantForm } from "@/components/tenant-form"

export default function NewTenantPage() {
  return (
    <div className="space-y-6 pt-2 md:pt-0">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Add New Tenant</h1>
        <p className="text-sm md:text-base text-muted-foreground">Enter the details for your new tenant</p>
      </div>

      <TenantForm />
    </div>
  )
}
