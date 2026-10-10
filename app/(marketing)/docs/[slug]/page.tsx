import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowUpRight } from "lucide-react"
import { docArticles, docCategories } from "@/lib/content/marketing"

export function generateStaticParams() {
  return docArticles.map((a) => ({ slug: a.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const a = docArticles.find((x) => x.slug === slug)
  if (!a) return { title: "Doc — PropDesk Africa" }
  return { title: `${a.title} — PropDesk Africa Docs`, description: a.excerpt }
}

function renderBody(body: string) {
  return body.split(/\n{2,}/g).map((block, i) => {
    if (block.startsWith("## ")) {
      return (
        <h2 key={i} className="mt-10 text-2xl font-medium tracking-[-0.02em]">
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

export default async function DocArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const article = docArticles.find((a) => a.slug === slug)
  if (!article) notFound()
  const category = docCategories.find((c) => c.slug === article.category)
  const related = docArticles.filter((a) => a.category === article.category && a.slug !== article.slug).slice(0, 4)

  return (
    <article className="bg-background py-16 lg:py-20">
      <div className="container-x max-w-3xl">
        <Link href="/docs" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="size-4" /> Back to docs
        </Link>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          {category?.name ?? "Docs"}
        </p>
        <h1 className="mt-3 text-4xl font-medium leading-[1.05] tracking-[-0.04em] sm:text-5xl">
          {article.title}
        </h1>
        <p className="mt-5 text-lg leading-7 text-muted-foreground">{article.excerpt}</p>
        <p className="mt-4 text-xs text-muted-foreground">
          {article.readingMinutes} min read · Updated {new Date(article.updated).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
        </p>

        <div className="mt-12">{renderBody(article.body)}</div>

        {related.length > 0 && (
          <div className="mt-16 border-t border-border pt-12">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Related</p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link
                    href={`/docs/${r.slug}`}
                    className="group flex flex-col rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary"
                  >
                    <p className="text-sm font-medium leading-tight">{r.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.excerpt}</p>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
                      Read article <ArrowUpRight className="size-3" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </article>
  )
}