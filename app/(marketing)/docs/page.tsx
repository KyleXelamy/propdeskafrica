import type { Metadata } from "next"
import Link from "next/link"
import { ArrowUpRight, BookOpen, Code2, Layers, Settings2, ShieldCheck, Wallet } from "lucide-react"
import { docArticles, docCategories } from "@/lib/content/marketing"

export const metadata: Metadata = {
  title: "Docs — I-Manage by Siemax Ltd",
  description: "Guides, API reference and integration docs for I-Manage.",
}

const articleCounts = docCategories.map((c) => ({
  ...c,
  count: docArticles.filter((a) => a.category === c.slug).length,
}))

export default function DocsHub() {
  const popular = docArticles.slice(0, 4)
  const recent = [...docArticles].sort((a, b) => b.updated.localeCompare(a.updated)).slice(0, 5)

  return (
    <>
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_50%_30%,#d9f45b,transparent_55%)]" />
        <div className="container-x relative pt-32 pb-16 lg:pt-44">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Documentation</p>
          <h1 className="mt-6 text-5xl font-medium leading-[0.98] tracking-[-0.05em] sm:text-7xl">
            Everything you need to ship.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-primary-foreground/70">
            Guides for every workflow, a full REST + webhooks reference, and the data you need to
            integrate I-Manage into your stack.
          </p>
          <form action="/docs" className="mt-8 flex max-w-md gap-2">
            <input
              type="search"
              name="q"
              placeholder="Search docs…"
              className="flex-1 rounded-full border border-primary-foreground/15 bg-primary-foreground/5 px-5 py-2.5 text-sm text-primary-foreground placeholder:text-primary-foreground/40 focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <button
              type="submit"
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-primary hover:bg-accent/90"
            >
              Search
            </button>
          </form>
        </div>
      </section>

      {/* Categories */}
      <section className="bg-background py-16 lg:py-20">
        <div className="container-x">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Categories</p>
          <h2 className="mt-3 text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-4xl">
            Browse by topic.
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {articleCounts.map((c) => (
              <Link
                key={c.slug}
                href={`/docs/category/${c.slug}`}
                className="group flex flex-col rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-md"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-secondary text-primary">
                  {c.slug === "getting-started" ? <BookOpen className="size-5" /> :
                    c.slug === "api" ? <Code2 className="size-5" /> :
                    c.slug === "integrations" ? <Layers className="size-5" /> :
                    c.slug === "security" ? <ShieldCheck className="size-5" /> :
                    c.slug === "billing" ? <Wallet className="size-5" /> :
                    <Settings2 className="size-5" />}
                </span>
                <p className="mt-8 text-base font-medium leading-tight">{c.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>
                <span className="mt-5 inline-flex items-center justify-between text-xs text-muted-foreground">
                  <span>{c.count} article{c.count === 1 ? "" : "s"}</span>
                  <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Popular */}
      <section className="bg-secondary/40 py-16">
        <div className="container-x grid gap-10 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Popular</p>
            <h2 className="mt-3 text-2xl font-medium leading-tight tracking-[-0.04em]">Most read this month</h2>
            <ul className="mt-8 space-y-3">
              {popular.map((a) => (
                <li key={a.slug}>
                  <Link
                    href={`/docs/${a.slug}`}
                    className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary"
                  >
                    <span className="mt-1 grid size-6 shrink-0 place-items-center rounded-md bg-secondary text-xs font-semibold text-primary">
                      {a.readingMinutes}m
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight">{a.title}</p>
                      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{a.excerpt}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Recently updated</p>
            <h2 className="mt-3 text-2xl font-medium leading-tight tracking-[-0.04em]">Fresh from the team</h2>
            <ul className="mt-8 space-y-3">
              {recent.map((a) => (
                <li key={a.slug}>
                  <Link
                    href={`/docs/${a.slug}`}
                    className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary"
                  >
                    <p className="text-sm font-medium leading-tight">{a.title}</p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(a.updated).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  )
}