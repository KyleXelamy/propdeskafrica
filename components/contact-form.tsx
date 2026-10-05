"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, CheckCircle2 } from "lucide-react"
import { BRAND } from "@/lib/brand"

type FormState = { status: "idle" | "success" | "error"; message?: string }

export function ContactForm() {
  const [state, setState] = useState<FormState>({ status: "idle" })
  const [pending, startTransition] = useTransition()

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = Object.fromEntries(form.entries())

    startTransition(async () => {
      try {
        const res = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          setState({ status: "error", message: body?.error || "Something went wrong. Try again?" })
          return
        }
        setState({
          status: "success",
          message: body?.message || `Your email app is ready. Press Send to contact ${BRAND.company}.`,
        })
        form.reset()
        if (body?.mailto) window.location.assign(body.mailto)
      } catch (err) {
        setState({ status: "error", message: "Network error. Please try again." })
      }
    })
  }

  if (state.status === "success") {
    return (
      <div className="mt-8 rounded-2xl border border-success/40 bg-success/10 p-8 text-success-foreground">
        <div className="flex items-center gap-3 text-success">
          <CheckCircle2 className="size-5" />
          <p className="font-medium">Message sent.</p>
        </div>
        <p className="mt-3 text-sm leading-6 text-foreground/80">{state.message}</p>
        <button
          type="button"
          onClick={() => setState({ status: "idle" })}
          className="mt-6 text-sm font-medium text-primary underline"
        >
          Send another →
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5">
      {state.status === "error" && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {state.message}
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="first_name">First name</Label>
          <Input id="first_name" name="first_name" type="text" required placeholder="Aisha" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="last_name">Last name</Label>
          <Input id="last_name" name="last_name" type="text" required placeholder="Otieno" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required placeholder="you@example.com" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="company">Company / Portfolio (optional)</Label>
        <Input id="company" name="company" type="text" placeholder="e.g. Kiarie Holdings" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="topic">What can we help with?</Label>
        <select
          id="topic"
          name="topic"
          required
          defaultValue=""
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="" disabled>Select a topic…</option>
          <option value="sales">Sales / pricing question</option>
          <option value="demo">Book a demo</option>
          <option value="support">Existing customer support</option>
          <option value="partnership">Partnership / agency</option>
          <option value="other">Something else</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">Message</Label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          placeholder="Tell us about your portfolio and what you'd like help with."
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Honeypot for bots */}
      <input type="text" name="company_website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto"
      >
        {pending ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Sending…
          </>
        ) : (
          "Send message"
        )}
      </Button>
    </form>
  )
}
