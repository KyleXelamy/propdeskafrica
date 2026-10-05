import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, ArrowUpRight } from "lucide-react"
import { features } from "@/lib/content/marketing"
import * as Icons from "lucide-react"

export const metadata: Metadata = {
  title: "Features — I-Manage by Siemax Ltd",
  description: "Every feature that makes I-Manage the calm operating system for ambitious landlords.",
}

export default function FeaturesHub() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_50%_30%,#d9f45b,transparent_55%)]" />
        <div className="container-x relative pt-32 pb-20 lg:pt-44 lg:pb-28">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Product</p>
            <h1 className="mt-6 text-5xl font-medium leading-[0.98] tracking-[-0.05em] sm:text-7xl">
              One product. Every workflow.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-primary-foreground/70">
              From rent collection to maintenance, documents to reports — I-Manage replaces the
              spreadsheets, the WhatsApp threads and the Sunday-night reconciliation.
            </p>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="bg-background py-16 lg:py-24">
        <div className="container-x">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => {
              const Icon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[f.icon]
              return (
                <Link
                  key={f.slug}
                  href={`/features/${f.slug}`}
                  className="group flex flex-col rounded-3xl border border-border bg-card p-7 transition-all hover:border-primary hover:shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <span className="grid size-11 place-items-center rounded-2xl bg-secondary text-primary">
                      {Icon ? <Icon className="size-5" /> : null}
                    </span>
                    <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </div>
                  <h2 className="mt-10 text-xl font-medium leading-tight tracking-[-0.03em]">{f.name}</h2>
                  <p className="mt-2 text-sm font-medium text-primary">{f.tagline}</p>
                  <p className="mt-4 flex-1 text-sm leading-6 text-muted-foreground">{f.summary}</p>
                  <ul className="mt-6 space-y-2 border-t border-border pt-5 text-xs">
                    {f.bullets.slice(0, 3).map((b) => (
                      <li key={b} className="flex items-start gap-2 text-muted-foreground">
                        <span className="mt-1 size-1.5 shrink-0 rounded-full bg-accent" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-accent text-accent-foreground py-20">
        <div className="container-x text-center">
          <h2 className="mx-auto max-w-2xl text-4xl font-medium leading-tight tracking-[-0.04em] sm:text-5xl">
            See it in action.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base leading-7 text-accent-foreground/80">
            Start free with up to 3 units. No credit card. No phone calls.
          </p>
          <Link
            href="/auth/sign-up"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Start free <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    </>
  )
}