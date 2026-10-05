"use client"

import { TenantForm } from "@/components/tenant-form"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"
import { tenantName } from "@/lib/utils"

export default function EditTenantPage() {
  const params = useParams<{ id: string }>()
  const [tenant, setTenant] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!params?.id) return
    const fetchTenant = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("tenants")
          .select("*")
          .eq("id", params.id)
          .maybeSingle()
        if (error) throw error
        if (!data) setNotFound(true)
        else setTenant(data)
      } catch (error) {
        console.error("[i-manage] fetch tenant error", error)
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    fetchTenant()
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
      <div className="text-center py-10">
        <p className="text-muted-foreground">Tenant not found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pt-2 md:pt-0">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Edit Tenant</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Update the details for {tenantName(tenant)}
        </p>
      </div>

      <TenantForm tenant={tenant} isEditing={true} />
    </div>
  )
}
