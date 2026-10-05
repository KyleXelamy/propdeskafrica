import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, StickyNote, Pin, MapPin, Loader2 } from "lucide-react"
import Link from "next/link"
import { formatDate, tenantName } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function NotesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const { data: notes, error } = await supabase
    .from("notes")
    .select(`
      *,
      properties (name, address),
      tenants (full_name, first_name, last_name)
    `)
    .eq("user_id", user.id)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[i-manage] notes fetch error", error)
  }

  const pinnedNotes = notes?.filter((note) => note.is_pinned) || []
  const regularNotes = notes?.filter((note) => !note.is_pinned) || []

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "important":
        return "bg-destructive text-destructive-foreground"
      case "reminder":
        return "bg-secondary text-secondary-foreground"
      case "general":
        return "bg-primary text-primary-foreground"
      case "maintenance":
        return "bg-chart-2 text-white"
      case "financial":
        return "bg-chart-4 text-white"
      case "legal":
        return "bg-chart-3 text-white"
      case "tenant":
        return "bg-secondary text-secondary-foreground"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const NoteCard = ({ note }: { note: any }) => (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 flex-1 min-w-0">
            <CardTitle className="text-lg flex items-center gap-2">
              {note.is_pinned && <Pin className="h-4 w-4 text-secondary flex-shrink-0" />}
              <Link href={`/dashboard/notes/${note.id}`} className="truncate hover:underline">
                {note.title || "Untitled Note"}
              </Link>
            </CardTitle>
            <div className="text-sm text-muted-foreground space-y-0.5">
              {note.properties && (
                <div className="flex items-center gap-1 truncate">
                  <MapPin className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{note.properties.name}</span>
                </div>
              )}
              {note.tenants && <div className="truncate">{tenantName(note.tenants)}</div>}
              <div>{formatDate(note.created_at)}</div>
            </div>
          </div>
          <Badge className={`${getCategoryColor(note.category || "general")} flex-shrink-0`}>
            {note.category || "general"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">{note.content}</p>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" className="flex-1 bg-transparent" asChild>
            <Link href={`/dashboard/notes/${note.id}`}>View Full Note</Link>
          </Button>
          <Button variant="outline" size="sm" className="flex-1 bg-transparent" asChild>
            <Link href={`/dashboard/notes/${note.id}/edit`}>Edit</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6 pt-2 md:pt-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Notes</h1>
          <p className="text-sm md:text-base text-muted-foreground">Keep track of important information and reminders</p>
        </div>
        <Button asChild className="bg-primary hover:bg-primary/90 w-full sm:w-auto">
          <Link href="/dashboard/notes/new">
            <Plus className="h-4 w-4 mr-2" />
            New Note
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Notes</CardTitle>
            <StickyNote className="h-4 w-4 text-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{notes?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pinned Notes</CardTitle>
            <Pin className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-secondary">{pinnedNotes.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recent Notes</CardTitle>
            <StickyNote className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {notes?.filter((note) => {
                const noteDate = new Date(note.created_at)
                const weekAgo = new Date()
                weekAgo.setDate(weekAgo.getDate() - 7)
                return noteDate > weekAgo
              }).length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {pinnedNotes.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Pin className="h-5 w-5 text-secondary" />
            <h2 className="text-xl font-semibold text-foreground">Pinned Notes</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {pinnedNotes.map((note) => (
              <NoteCard key={note.id} note={note} />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">All Notes</h2>
        {regularNotes.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {regularNotes.map((note) => (
              <NoteCard key={note.id} note={note} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-8">
              <StickyNote className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No notes created yet</p>
              <Button asChild>
                <Link href="/dashboard/notes/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Note
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
