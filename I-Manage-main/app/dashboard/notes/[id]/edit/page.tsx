import { NoteForm } from "@/components/note-form"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function EditNotePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: note } = await supabase
    .from("notes")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()

  return (
    <div className="space-y-6 pt-2 md:pt-0">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Edit Note</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Update the note details
        </p>
      </div>
      {note ? <NoteForm note={note} isEditing={true} /> : <p className="text-muted-foreground">Note not found</p>}
    </div>
  )
}
