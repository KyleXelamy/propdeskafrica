"use client"

import { useState, useTransition } from "react"
import { CheckCircle2, Loader2 } from "lucide-react"

export function SubmitIdeaForm() {
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = Object.fromEntries(new FormData(e.currentTarget).entries())
    startTransition(async () => {
      try {
        const r = await fetch("/api/customer-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
        const body = await r.json().catch(() => ({}))
        if (!r.ok) {
          setError(body?.error ?? "Couldn't submit. Try again?")
          return
        }
        setDone(true)
        e.currentTarget.reset()
      } catch {
        setError("Network error. Please try again.")
      }
    })
  }

  if (done) {
    return (
      <div className="mt-8 rounded-2xl border border-success/40 bg-success/10 p-8">
        <div className="flex items-center gap-3 text-success">
          <CheckCircle2 className="size-5" />
          <p className="font-medium">Idea submitted.</p>
        </div>
        <p className="mt-3 text-sm leading-6 text-foreground/80">
          Thanks — we'll review it within 5 business days. If we have questions we'll email you.
        </p>
        <button
          type="button"
          onClick={() => setDone(false)}
          className="mt-6 text-sm font-medium text-primary underline"
        >
          Submit another →
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5 rounded-2xl border border-border bg-card p-6">
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="idea-title">Idea title</label>
        <input
          id="idea-title"
          name="title"
          type="text"
          required
          placeholder="e.g. WhatsApp tenant bot"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="idea-body">Describe it</label>
        <textarea
          id="idea-body"
          name="body"
          rows={5}
          placeholder="What's the problem you're trying to solve? What would success look like?"
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="idea-email">Email (optional)</label>
        <input
          id="idea-email"
          name="email"
          type="email"
          placeholder="So we can follow up"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        {pending ? <><Loader2 className="mr-2 inline size-4 animate-spin" /> Submitting…</> : "Submit idea"}
      </button>
    </form>
  )
}