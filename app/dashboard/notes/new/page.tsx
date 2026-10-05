import { NoteForm } from "@/components/note-form"

export default function NewNotePage() {
  return (
    <div className="space-y-6 pt-2 md:pt-0">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Create New Note</h1>
        <p className="text-sm md:text-base text-muted-foreground">Add a new note or reminder</p>
      </div>

      <NoteForm />
    </div>
  )
}
