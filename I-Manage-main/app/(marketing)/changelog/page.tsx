import type { Metadata } from "next"
import Link from "next/link"
import { ArrowUpRight, Sparkles, Wrench, ShieldCheck, Bug } from "lucide-react"
import { changelog, type ChangelogEntry } from "@/lib/content/site"

export const metadata: Metadata = {
  title: "Changelog — I-Manage by Siemax Ltd",
  description: "Every product update, improvement and fix we've shipped.",
}

const typeMeta: Record<ChangelogEntry["type"], { icon: typeof Sparkles; label: string; color: string }> = {
  feature: { icon: Sparkles, label: "New", color: "bg-accent text-accent-foreground" },
  improvement: { icon: Wrench, label: "Improved", color: "bg-secondary text-secondary-foreground" },
  fix: { icon: Bug, label: "Fixed", color: "bg-muted text-muted-foreground" },
  security: { icon: ShieldCheck, label: "Security", color: "bg-primary text-primary-foreground" },
}

export default function ChangelogPage() {
  const grouped = changelog.reduce<Record<string, ChangelogEntry[]>>((acc, entry) => {
    const year = entry.date.slice(0, 4)
    acc[year] = acc[year] || []
    acc[year].push(entry)
    return acc
  }, {})

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_80%_20%,#d9f45b,transparent_55%)]" />
        <div className="container-x relative pt-40 pb-20 lg:pt-56 lg:pb-28">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Changelog</p>
            <h1 className="mt-6 text-5xl font-medium leading-[0.98] tracking-[-0.05em] sm:text-7xl">
              What we shipped, in public.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-primary-foreground/70">
              Every release, improvement and bug fix. Subscribe via the footer or follow our RSS feed.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-background py-20 lg:py-24">
        <div className="container-x max-w-3xl">
          {Object.entries(grouped).map(([year, entries]) => (
            <div key={year} className="mb-16">
              <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{year}</h2>
              <ol className="mt-6 space-y-10 border-l border-border pl-8">
                {entries.map((e) => {
                  const Meta = typeMeta[e.type]
                  return (
                    <li key={e.version} className="relative">
                      <span className="absolute -left-[37px] top-2 grid size-4 place-items-center rounded-full border-4 border-background bg-primary" />
                      <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        <span>{new Date(e.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                        <span aria-hidden>·</span>
                        <span>{e.version}</span>
                        <span className={`ml-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] ${Meta.color}`}>
                          <Meta.icon className="size-3" /> {Meta.label}
                        </span>
                      </div>
                      <h3 className="mt-3 text-xl font-medium leading-tight tracking-[-0.03em]">{e.title}</h3>
                      <p className="mt-2 text-base leading-7 text-foreground/85">{e.body}</p>
                    </li>
                  )
                })}
              </ol>
            </div>
          ))}

          <div className="mt-16 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Want updates in your inbox?{" "}
            <Link href="/resources" className="font-medium text-primary underline">
              Subscribe to the changelog RSS →
            </Link>
          </div>
        </div>
      </section>

    </main>
  )
}