import type { Metadata } from "next"
import Link from "next/link"
import { ArrowUpRight, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { blogPosts } from "@/lib/content/blog"
import { NewsletterForm } from "@/components/newsletter-form"
import { ResourceSearch } from "@/components/resource-search"

export const metadata: Metadata = {
  title: "Resources — PropDesk Africa by Siemax Ltd",
  description:
    "Field notes, product deep dives and practical guides for landlords running a real property portfolio.",
}

const categories = ["All", "Product", "Operations", "Finance", "Field notes", "Compliance"] as const

export default function ResourcesPage() {
  // Featured = newest excluding first
  const featured = blogPosts.slice(1, 3)
  const hero = blogPosts[0]

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_80%_20%,#d9f45b,transparent_55%)]" />
        <div className="container-x relative pt-40 pb-20 lg:pt-56 lg:pb-28">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Resources</p>
            <h1 className="mt-6 text-5xl font-medium leading-[0.98] tracking-[-0.05em] sm:text-7xl">
              Field notes for the <em className="font-serif font-normal text-accent">ambitious landlord.</em>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-primary-foreground/70">
              Product updates, financial deep dives and the occasional opinionated rant. Written by
              the team — and the landlords — building PropDesk Africa.
            </p>
          </div>
        </div>
      </section>

      {/* Featured grid */}
      <section className="bg-background py-16 lg:py-24">
        <div className="container-x">
          {/* Category filter (visual, non-functional without JS — wired to /api/blog) */}
          <div className="flex flex-wrap items-center gap-2">
            {categories.map((c, i) => (
              <Link
                key={c}
                href={i === 0 ? "/resources" : `/resources?category=${encodeURIComponent(c)}`}
                className={
                  "rounded-full border px-4 py-1.5 text-sm transition-colors " +
                  (i === 0
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:border-primary hover:text-primary")
                }
              >
                {c}
              </Link>
            ))}
          </div>

          {/* Search */}
          <div className="mt-6">
            <ResourceSearch mode="post" />
          </div>

          {/* Hero post */}
          <Link
            href={`/resources/${hero.slug}`}
            className="mt-10 grid gap-8 rounded-3xl border border-border bg-card p-6 transition-shadow hover:shadow-xl lg:grid-cols-[1.1fr_1fr] lg:p-10"
          >
            <div className="aspect-[16/10] overflow-hidden rounded-2xl bg-muted">
              <img src={hero.cover} alt="" className="h-full w-full object-cover" />
            </div>
            <div className="flex flex-col justify-center">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-foreground/80">
                {hero.category} · {new Date(hero.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · {hero.readingMinutes} min read
              </p>
              <h2 className="mt-4 text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-5xl">
                {hero.title}
              </h2>
              <p className="mt-5 text-base leading-7 text-muted-foreground">{hero.excerpt}</p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary">
                Read the article <ArrowRight className="size-4" />
              </span>
            </div>
          </Link>

          {/* Two-up */}
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {featured.map((post) => (
              <Link
                key={post.slug}
                href={`/resources/${post.slug}`}
                className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-card transition-shadow hover:shadow-lg"
              >
                <div className="aspect-[16/10] overflow-hidden bg-muted">
                  <img
                    src={post.cover}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="flex flex-1 flex-col p-7">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    {post.category} · {post.readingMinutes} min read
                  </p>
                  <h3 className="mt-3 text-xl font-medium leading-tight tracking-[-0.03em]">
                    {post.title}
                  </h3>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">{post.excerpt}</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary">
                    Read more <ArrowRight className="size-4" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* All posts */}
      <section className="bg-secondary/40 py-20 lg:py-24">
        <div className="container-x">
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">All posts</p>
              <h2 className="mt-4 text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-4xl">
                Every article we've published.
              </h2>
            </div>
            <Link
              href="/api/blog"
              className="hidden text-sm font-medium text-primary underline sm:inline"
            >
              As JSON →
            </Link>
          </div>

          <ul className="mt-10 divide-y divide-border rounded-2xl border border-border bg-card">
            {blogPosts.map((post) => (
              <li key={post.slug}>
                <Link
                  href={`/resources/${post.slug}`}
                  className="flex flex-col gap-4 p-6 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {post.category} · {new Date(post.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                    <p className="mt-2 text-lg font-medium leading-tight">{post.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{post.excerpt}</p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-primary">
                    {post.readingMinutes} min <ArrowUpRight className="size-4" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Newsletter */}
      <section className="bg-primary text-primary-foreground py-20">
        <div className="container-x grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Newsletter</p>
            <h2 className="mt-4 text-4xl font-medium leading-tight tracking-[-0.04em] sm:text-5xl">
              One email a month. No fluff.
            </h2>
            <p className="mt-4 max-w-md text-base leading-7 text-primary-foreground/70">
              New posts, occasional product updates, and the kind of insight you can act on. Unsubscribe
              in one click, no hard feelings.
            </p>
          </div>
          <div>
            <NewsletterForm source="resources" />
            <p className="mt-3 text-xs text-primary-foreground/50">
              We use this only for the newsletter. Never sold. Never spammed.
            </p>
          </div>
        </div>
      </section>

    </main>
  )
}