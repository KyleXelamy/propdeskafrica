import type { Metadata } from "next"
import Link from "next/link"
import { ArrowUpRight, Sparkles } from "lucide-react"
import { FeedbackBoard } from "@/components/feedback-board"
import { SubmitIdeaForm } from "@/components/submit-idea-form"
import { roadmap } from "@/lib/content/marketing"

export const metadata: Metadata = {
  title: "Customer requests — PropDesk Africa",
  description: "Submit ideas, vote on what gets built next, and track their status.",
}

export default function CustomerRequestsPage() {
  // Real numbers, derived from the same roadmap the board renders. These
  // used to be hardcoded placeholders (128 / 47 / 92%) that had nothing to
  // do with the actual board.
  const shipped = roadmap.filter((r) => r.status === "Shipped").length
  const top = [...roadmap].sort((a, b) => b.votes - a.votes)[0]
  const stats = [
    { k: String(roadmap.length), v: "Ideas on the board" },
    { k: String(shipped), v: "Ideas already shipped" },
    { k: String(top?.votes ?? 0), v: `Votes on the top request` },
  ]

  return (
    <>
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_50%_30%,#d9f45b,transparent_55%)]" />
        <div className="container-x relative pt-32 pb-16 lg:pt-44">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Feedback</p>
          <h1 className="mt-6 max-w-3xl text-5xl font-medium leading-[0.98] tracking-[-0.05em] sm:text-7xl">
            Tell us what to build.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-primary-foreground/70">
            Submit ideas, vote on what we should work on next, and watch the roadmap update in real
            time. No dark patterns, no "feature requests" landing pages — actual progress.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/roadmap"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-primary hover:bg-accent/90"
            >
              <Sparkles className="size-4" /> See the roadmap
            </Link>
            <Link
              href="#submit"
              className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/30 px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-foreground/10"
            >
              Submit an idea <ArrowUpRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-background py-12">
        <div className="container-x grid gap-4 md:grid-cols-3">
          {stats.map((s) => (
            <div key={s.k} className="rounded-2xl border border-border bg-card p-6">
              <p className="text-3xl font-medium tracking-tight">{s.k}</p>
              <p className="mt-2 text-sm text-muted-foreground">{s.v}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-secondary/40 py-16 lg:py-20">
        <div className="container-x">
          <FeedbackBoard />
        </div>
      </section>

      <section id="submit" className="bg-background py-20">
        <div className="container-x max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Submit an idea</p>
          <h2 className="mt-3 text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-4xl">
            What should we build next?
          </h2>
          <SubmitIdeaForm />
        </div>
      </section>
    </>
  )
}
