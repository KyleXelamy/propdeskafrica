import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowUpRight } from "lucide-react"
import { docArticles, docCategories } from "@/lib/content/marketing"

export function generateStaticParams() {
  return docCategories.map((c) => ({ category: c.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>
}): Promise<Metadata> {
  const { category } = await params
  const c = docCategories.find((x) => x.slug === category)
  if (!c) return { title: "Docs — PropDesk Africa" }
  return { title: `${c.name} — PropDesk Africa Docs`, description: c.description }
}

export default async function DocsCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>
}) {
  const { category } = await params
  const c = docCategories.find((x) => x.slug === category)
  if (!c) notFound()
  const articles = docArticles.filter((a) => a.category === category)

  return (
    <article className="bg-background py-16 lg:py-20">
      <div className="container-x max-w-3xl">
        <Link href="/docs" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="size-4" /> Back to docs
        </Link>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Docs · Category</p>
        <h1 className="mt-3 text-4xl font-medium leading-[1.05] tracking-[-0.04em] sm:text-5xl">
          {c.name}
        </h1>
        <p className="mt-5 text-lg leading-7 text-muted-foreground">{c.description}</p>

        <ul className="mt-12 divide-y divide-border rounded-2xl border border-border bg-card">
          {articles.length === 0 ? (
            <li className="p-6 text-sm text-muted-foreground">No articles yet. Check back soon.</li>
          ) : (
            articles.map((a) => (
              <li key={a.slug}>
                <Link href={`/docs/${a.slug}`} className="flex items-start gap-3 p-5 transition-colors hover:bg-muted/40">
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-medium leading-tight">{a.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.excerpt}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {a.readingMinutes} min read · Updated {new Date(a.updated).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))
          )}
        </ul>
      </div>
    </article>
  )
}