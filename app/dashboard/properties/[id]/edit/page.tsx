"use client"

import { PropertyForm } from "@/components/property-form"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"

export default function EditPropertyPage() {
  const params = useParams<{ id: string }>()
  const [property, setProperty] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!params?.id) return
    const fetchProperty = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("properties")
          .select("*")
          .eq("id", params.id)
          .maybeSingle()
        if (error) throw error
        if (!data) setNotFound(true)
        else setProperty(data)
      } catch (error) {
        console.error("[i-manage] fetch property error", error)
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    fetchProperty()
  }, [params?.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (notFound || !property) {
    return (
      <div className="text-center py-10">
        <p className="text-muted-foreground">Property not found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pt-2 md:pt-0">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Edit Property</h1>
        <p className="text-sm md:text-base text-muted-foreground">Update the details for {property.name}</p>
      </div>

      <PropertyForm property={property} isEditing={true} />
    </div>
  )
}
