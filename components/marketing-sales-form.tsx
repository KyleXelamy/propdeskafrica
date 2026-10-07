"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, CheckCircle2 } from "lucide-react"

type State = { status: "idle" | "success" | "error"; message?: string }

export function MarketingSalesForm() {
  const [state, setState] = useState<State>({ status: "idle" })
  const [pending, startTransition] = useTransition()

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = Object.fromEntries(new FormData(e.currentTarget).entries())
    startTransition(async () => {
      try {
        const r = await fetch("/api/pricing/lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
        const body = await r.json().catch(() => ({}))
        if (!r.ok) {
          setState({ status: "error", message: body?.error ?? "Couldn't send. Try again?" })
          return
        }
        setState({ status: "success", message: body?.message ?? "We'll be in touch within one business day." })
        e.currentTarget.reset()
      } catch {
        setState({ status: "error", message: "Network error. Please try again." })
      }
    })
  }

  if (state.status === "success") {
    return (
      <div className="mt-8 rounded-2xl border border-success/40 bg-success/10 p-8 text-foreground">
        <div className="flex items-center gap-3 text-success">
          <CheckCircle2 className="size-5" />
          <p className="font-medium">Request received.</p>
        </div>
        <p className="mt-3 text-sm leading-6 text-foreground/80">{state.message}</p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="mt-7 space-y-5">
      {state.status === "error" && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {state.message}
        </div>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Your name</Label>
          <Input id="name" name="name" type="text" required placeholder="Brian Kiarie" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" name="email" type="email" required placeholder="bknglabs.dev@gmail.com" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="company">Company</Label>
        <Input id="company" name="company" type="text" placeholder="e.g. Kiarie Holdings" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="portfolio_size">How many units do you manage?</Label>
        <select
          id="portfolio_size"
          name="portfolio_size"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          defaultValue=""
        >
          <option value="" disabled>Select a range…</option>
          <option value="1-10">1–10</option>
          <option value="11-50">11–50</option>
          <option value="51-200">51–200</option>
          <option value="201-500">201–500</option>
          <option value="500+">500+</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Anything we should know?</Label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          placeholder="What you're using today, biggest pain, timeline."
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto"
      >
        {pending ? <><Loader2 className="mr-2 size-4 animate-spin" /> Sending…</> : "Book a call"}
      </Button>
    </form>
  )
}
