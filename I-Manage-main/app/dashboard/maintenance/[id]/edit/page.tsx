"use client"

import { MaintenanceForm } from "@/components/maintenance-form"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"

export default function EditMaintenancePage() {
  const params = useParams<{ id: string }>()
  const [maintenanceRequest, setMaintenanceRequest] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!params?.id) return
    const fetchRequest = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("maintenance_requests")
          .select("*")
          .eq("id", params.id)
          .maybeSingle()
        if (error) throw error
        if (!data) setNotFound(true)
        else setMaintenanceRequest(data)
      } catch (error) {
        console.error("[i-manage] fetch maintenance request error", error)
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    fetchRequest()
  }, [params?.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (notFound || !maintenanceRequest) {
    return (
      <div className="text-center py-10">
        <p className="text-muted-foreground">Maintenance request not found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pt-2 md:pt-0">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Edit Maintenance Request</h1>
        <p className="text-sm md:text-base text-muted-foreground">Update the details for "{maintenanceRequest.title}"</p>
      </div>

      <MaintenanceForm maintenanceRequest={maintenanceRequest} isEditing={true} />
    </div>
  )
}
