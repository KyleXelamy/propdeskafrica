"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Pin, MapPin, ArrowLeft, Edit, Loader2 } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { DeleteButton } from "@/components/delete-button"
import { formatDate, tenantName } from "@/lib/utils"

export default function NoteDetailPage() {
  const params = useParams<{ id: string }>()
  const [note, setNote] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!params?.id) return
    const fetchNote = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("notes")
          .select(`
            *,
            properties (name, address),
            tenants (full_name, first_name, last_name)
          `)
          .eq("id", params.id)
          .maybeSingle()
        if (error) throw error
        if (!data) setNotFound(true)
        else setNote(data)
      } catch (err) {
        console.error("[i-manage] fetch note error", err)
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    fetchNote()
  }, [params?.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (notFound || !note) {
    return (
      <div className="text-center py-10 space-y-4">
        <p className="text-muted-foreground">Note not found</p>
        <Button asChild variant="outline">
          <Link href="/dashboard/notes">Back to Notes</Link>
        </Button>
      </div>
    )
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "important": return "bg-destructive text-destructive-foreground"
      case "reminder": return "bg-secondary text-secondary-foreground"
      case "general": return "bg-primary text-primary-foreground"
      case "maintenance": return "bg-chart-2 text-white"
      case "financial": return "bg-chart-4 text-white"
      case "legal": return "bg-chart-3 text-white"
      case "tenant": return "bg-secondary text-secondary-foreground"
      default: return "bg-muted text-muted-foreground"
    }
  }

  return (
    <div className="space-y-6 pt-2 md:pt-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Button variant="ghost" size="icon" asChild className="flex-shrink-0 mt-1">
            <Link href="/dashboard/notes">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back to Notes</span>
            </Link>
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                {note.title || "Untitled Note"}
              </h1>
              {note.is_pinned && (
                <Badge variant="secondary" className="gap-1">
                  <Pin className="h-3 w-3" />
                  Pinned
                </Badge>
              )}
            </div>
            <p className="text-sm md:text-base text-muted-foreground">
              Created {formatDate(note.created_at)}
              {note.updated_at && note.updated_at !== note.created_at && (
                <> · Updated {formatDate(note.updated_at)}</>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm">
            <Link href={`/dashboard/notes/${note.id}/edit`}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Link>
          </Button>
          <DeleteButton
            endpoint={`/api/notes/${note.id}`}
            resource="note"
            redirectTo="/dashboard/notes"
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span>Content</span>
                <Badge className={getCategoryColor(note.category || "general")}>
                  {note.category || "general"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base whitespace-pre-wrap leading-relaxed">{note.content}</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {note.properties ? (
                <div>
                  <p className="text-muted-foreground text-xs">Property</p>
                  <Link
                    href={`/dashboard/properties/${note.properties.id || ""}`}
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <MapPin className="h-3 w-3" />
                    {note.properties.name}
                  </Link>
                  {note.properties.address && (
                    <p className="text-xs text-muted-foreground mt-0.5">{note.properties.address}</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No property linked</p>
              )}
              {note.tenants && (
                <div>
                  <p className="text-muted-foreground text-xs">Tenant</p>
                  <p className="font-medium">{tenantName(note.tenants)}</p>
                </div>
              )}
              {note.priority && (
                <div>
                  <p className="text-muted-foreground text-xs">Priority</p>
                  <Badge variant={note.priority === "high" ? "destructive" : note.priority === "low" ? "secondary" : "outline"}>
                    {note.priority}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
