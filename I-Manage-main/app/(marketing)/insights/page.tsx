import type { Metadata } from "next"
import Link from "next/link"
import { ArrowUpRight, ArrowRight } from "lucide-react"
import { insights } from "@/lib/content/marketing"

export const metadata: Metadata = {
  title: "Insights — I-Manage by Siemax Ltd",
  description: "Longer reads, market analysis and field reports from the I-Manage team.",
}

export default function InsightsHub() {
  const [hero, ...rest] = insights

  return (
    <>
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_50%_30%,#d9f45b,transparent_55%)]" />
        <div className="container-x relative pt-32 pb-16 lg:pt-44">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Insights</p>
          <h1 className="mt-6 text-5xl font-medium leading-[0.98] tracking-[-0.05em] sm:text-7xl">
            Field reports &amp; market takes.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-primary-foreground/70">
            The longer reads from the team — analysis, market takes and what we learned building
            I-Manage in the messy real world.
          </p>
        </div>
      </section>

      <section className="bg-background py-12 lg:py-16">
        <div className="container-x">
          <Link
            href={`/insights/${hero.slug}`}
            className="group grid gap-8 overflow-hidden rounded-3xl border border-border bg-card lg:grid-cols-[1.1fr_1fr]"
          >
            <div className="aspect-[16/10] overflow-hidden bg-muted lg:aspect-auto">
              <img src={hero.cover} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
            </div>
            <div className="flex flex-col justify-center p-8 lg:p-10">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Featured · {hero.readingMinutes} min read
              </p>
              <h2 className="mt-3 text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-4xl">{hero.title}</h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">{hero.excerpt}</p>
              <p className="mt-5 text-sm text-muted-foreground">By {hero.author}</p>
              <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                Read the essay <ArrowRight className="size-4" />
              </span>
            </div>
          </Link>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {rest.map((p) => (
              <Link
                key={p.slug}
                href={`/insights/${p.slug}`}
                className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-card transition-shadow hover:shadow-md"
              >
                <div className="aspect-[16/10] overflow-hidden bg-muted">
                  <img src={p.cover} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    {p.readingMinutes} min · {new Date(p.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                  <p className="mt-3 text-lg font-medium leading-tight tracking-[-0.02em]">{p.title}</p>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{p.excerpt}</p>
                  <p className="mt-4 text-xs text-muted-foreground">By {p.author}</p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                    Read <ArrowUpRight className="size-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}