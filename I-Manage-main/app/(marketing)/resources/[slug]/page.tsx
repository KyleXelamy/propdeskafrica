import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowRight, Calendar, Clock } from "lucide-react"
import { blogPosts, getBlogPost, getRelatedPosts } from "@/lib/content/blog"

export function generateStaticParams() {
  return blogPosts.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = getBlogPost(slug)
  if (!post) return { title: "Article — I-Manage" }
  return {
    title: `${post.title} — I-Manage`,
    description: post.excerpt,
    openGraph: { images: [post.cover] },
  }
}

function renderBody(body: string) {
  // Very small markdown-lite renderer (paragraphs, ## headings, bullet lists).
  const blocks = body.split(/\n{2,}/g)
  return blocks.map((block, i) => {
    if (block.startsWith("## ")) {
      return (
        <h2 key={i} className="mt-10 text-2xl font-medium tracking-[-0.02em] sm:text-3xl">
          {block.replace(/^## /, "")}
        </h2>
      )
    }
    if (block.startsWith("- ")) {
      const items = block.split(/\n/).map((l) => l.replace(/^- /, ""))
      return (
        <ul key={i} className="mt-6 space-y-3">
          {items.map((it, j) => (
            <li key={j} className="flex gap-3">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )
    }
    return (
      <p key={i} className="mt-5 text-base leading-8 text-foreground/85 sm:text-lg">
        {block}
      </p>
    )
  })
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = getBlogPost(slug)
  if (!post) notFound()

  const related = getRelatedPosts(slug)

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="container-x relative pt-40 pb-12 lg:pt-52 lg:pb-16">
          <Link
            href="/resources"
            className="inline-flex items-center gap-2 text-sm text-primary-foreground/65 hover:text-accent"
          >
            <ArrowLeft className="size-4" /> Back to resources
          </Link>
          <div className="mt-8 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-accent">
            <span>{post.category}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="size-3.5" />
              {new Date(post.publishedAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5" /> {post.readingMinutes} min read
            </span>
          </div>
          <h1 className="mt-6 max-w-3xl text-4xl font-medium leading-[1.05] tracking-[-0.04em] sm:text-6xl">
            {post.title}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-primary-foreground/75">{post.excerpt}</p>
          <div className="mt-10 flex items-center gap-4">
            <div className="grid size-10 place-items-center rounded-full bg-accent text-sm font-medium text-primary">
              {post.author.initials}
            </div>
            <div>
              <p className="text-sm font-medium">{post.author.name}</p>
              <p className="text-xs text-primary-foreground/55">{post.author.role}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Cover image */}
      <div className="container-x -mt-1">
        <div className="aspect-[16/9] overflow-hidden rounded-3xl border border-border bg-muted">
          <img src={post.cover} alt="" className="h-full w-full object-cover" />
        </div>
      </div>

      {/* Body */}
      <article className="container-x max-w-3xl py-16 lg:py-24">
        <div className="prose prose-neutral max-w-none dark:prose-invert">{renderBody(post.body)}</div>

        {/* Tags */}
        <div className="mt-16 flex flex-wrap items-center gap-2 border-t border-border pt-10">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Tagged</span>
          {post.tags.map((t) => (
            <span key={t} className="rounded-full border border-border bg-card px-3 py-1 text-xs">
              #{t}
            </span>
          ))}
        </div>

        {/* Author footer */}
        <div className="mt-10 flex items-center gap-4 rounded-2xl border border-border bg-card p-6">
          <div className="grid size-12 place-items-center rounded-full bg-secondary text-sm font-medium text-primary">
            {post.author.initials}
          </div>
          <div>
            <p className="text-base font-medium">{post.author.name}</p>
            <p className="text-sm text-muted-foreground">{post.author.role}</p>
          </div>
        </div>
      </article>

      {/* Related */}
      {related.length > 0 && (
        <section className="bg-secondary/40 py-20">
          <div className="container-x">
            <h2 className="text-3xl font-medium tracking-[-0.04em] sm:text-4xl">Keep reading</h2>
            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/resources/${r.slug}`}
                  className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-card transition-shadow hover:shadow-lg"
                >
                  <div className="aspect-[16/10] overflow-hidden bg-muted">
                    <img
                      src={r.cover}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-7">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                      {r.category} · {r.readingMinutes} min read
                    </p>
                    <h3 className="mt-3 text-xl font-medium leading-tight tracking-[-0.03em]">{r.title}</h3>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">{r.excerpt}</p>
                    <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary">
                      Read article <ArrowRight className="size-4" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

    </main>
  )
}