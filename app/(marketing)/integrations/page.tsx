import type { Metadata } from "next"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { integrations } from "@/lib/content/site"

export const metadata: Metadata = {
  title: "Integrations — PropDesk Africa by Siemax Ltd",
  description: "Payments, accounting, communication and storage integrations for PropDesk Africa.",
}

const categories = ["Payments", "Accounting", "Communication", "Storage", "Productivity"] as const

const statusStyles: Record<string, string> = {
  Live: "bg-success/15 text-success",
  Beta: "bg-warning/15 text-warning",
  "Coming soon": "bg-muted text-muted-foreground",
}

export default function IntegrationsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_50%_30%,#d9f45b,transparent_55%)]" />
        <div className="container-x relative pt-40 pb-20 lg:pt-56 lg:pb-28">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Integrations</p>
            <h1 className="mt-6 text-5xl font-medium leading-[0.98] tracking-[-0.05em] sm:text-7xl">
              Plays nicely with your stack.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-primary-foreground/70">
              Connect PropDesk Africa to the tools you already use — payments, accounting, comms and storage.
              Agency and Enterprise customers can also build on our API.
            </p>
          </div>
        </div>
      </section>

      {categories.map((cat) => {
        const items = integrations.filter((i) => i.category === cat)
        if (items.length === 0) return null
        return (
          <section key={cat} className="bg-background py-16 first-of-type:pt-12 lg:py-20">
            <div className="container-x">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{cat}</p>
              <h2 className="mt-4 text-2xl font-medium leading-tight tracking-[-0.04em] sm:text-3xl">
                {cat === "Payments" && "Move money, safely."}
                {cat === "Accounting" && "Keep the books in sync."}
                {cat === "Communication" && "Talk to tenants where they already are."}
                {cat === "Storage" && "Backups, sorted."}
                {cat === "Productivity" && "Pipe PropDesk Africa into your daily tools."}
              </h2>
              <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {items.map((i) => (
                  <article
                    key={i.name}
                    className="flex flex-col rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-base font-medium leading-tight">{i.name}</p>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${statusStyles[i.status]}`}
                      >
                        {i.status}
                      </span>
                    </div>
                    <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">{i.description}</p>
                    <Link
                      href={i.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      Visit provider <ArrowUpRight className="size-3.5" />
                    </Link>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )
      })}

      {/* API callout */}
      <section className="bg-primary text-primary-foreground py-20">
        <div className="container-x grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">For developers</p>
            <h2 className="mt-5 text-4xl font-medium leading-tight tracking-[-0.04em] sm:text-5xl">
              Don't see what you need? Build it.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-primary-foreground/70">
              Agency and Enterprise customers get full REST + webhook access. Build the integration
              that fits your workflow — we'll publish your listing in this directory if it's useful.
            </p>
          </div>
          <div className="rounded-3xl border border-primary-foreground/10 bg-primary-foreground/5 p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">API at a glance</p>
            <ul className="mt-5 space-y-3 text-sm">
              <li className="flex justify-between gap-4 border-b border-primary-foreground/10 pb-3">
                <span>REST endpoints</span>
                <span className="font-mono text-accent">/api/*</span>
              </li>
              <li className="flex justify-between gap-4 border-b border-primary-foreground/10 pb-3">
                <span>Webhook events</span>
                <span className="font-mono text-accent">12 types</span>
              </li>
              <li className="flex justify-between gap-4 border-b border-primary-foreground/10 pb-3">
                <span>Auth</span>
                <span className="font-mono text-accent">Supabase JWT</span>
              </li>
              <li className="flex justify-between gap-4">
                <span>SLA</span>
                <span className="font-mono text-accent">99.9% (Agency)</span>
              </li>
            </ul>
            <Link
              href="/contact"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-primary hover:bg-accent/90"
            >
              Request API access <ArrowUpRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

    </main>
  )
}