"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, CheckCircle2 } from "lucide-react"

type State = { status: "idle" | "success" | "error"; message?: string }

export function NewsletterForm({ source = "footer" }: { source?: string }) {
  const [state, setState] = useState<State>({ status: "idle" })
  const [pending, startTransition] = useTransition()

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = Object.fromEntries(new FormData(e.currentTarget).entries())
    startTransition(async () => {
      try {
        const res = await fetch("/api/newsletter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, source }),
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          setState({ status: "error", message: body?.error || "Couldn't subscribe. Try again?" })
          return
        }
        setState({ status: "success", message: "You're in. Check your inbox for a confirmation." })
        e.currentTarget.reset()
      } catch {
        setState({ status: "error", message: "Network error. Please try again." })
      }
    })
  }

  if (state.status === "success") {
    return (
      <div className="flex items-center gap-2 text-sm text-primary-foreground/80">
        <CheckCircle2 className="size-4 text-accent" />
        {state.message}
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-2 sm:flex-row">
      <Input
        name="email"
        type="email"
        required
        placeholder="you@example.com"
        className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/40"
      />
      <Button
        type="submit"
        disabled={pending}
        className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : "Subscribe"}
      </Button>
      {state.status === "error" && (
        <p className="mt-1 text-xs text-destructive">{state.message}</p>
      )}
    </form>
  )
}