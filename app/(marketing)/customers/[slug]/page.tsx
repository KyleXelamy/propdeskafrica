import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowUpRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { customers } from "@/lib/content/marketing"

export function generateStaticParams() {
  return customers.map((c) => ({ slug: c.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const c = customers.find((x) => x.slug === slug)
  if (!c) return { title: "Customer — PropDesk Africa" }
  return {
    title: `${c.name} — PropDesk Africa customer story`,
    description: c.summary,
    openGraph: { images: [c.cover] },
  }
}

export default async function CustomerStoryPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const c = customers.find((x) => x.slug === slug)
  if (!c) notFound()
  const others = customers.filter((x) => x.slug !== c.slug).slice(0, 2)

  return (
    <>
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_50%_30%,#d9f45b,transparent_55%)]" />
        <div className="container-x relative pt-32 pb-12 lg:pt-44">
          <Link
            href="/customers"
            className="inline-flex items-center gap-2 text-sm text-primary-foreground/65 hover:text-accent"
          >
            <ArrowLeft className="size-4" /> All customers
          </Link>
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-accent">
            {c.industry} · {c.units} · {c.location}
          </p>
          <h1 className="mt-4 max-w-3xl text-5xl font-medium leading-[1.05] tracking-[-0.04em] sm:text-7xl">
            {c.name}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-7 text-primary-foreground/75">{c.summary}</p>
        </div>
      </section>

      <section className="container-x -mt-1">
        <div className="aspect-[16/7] overflow-hidden rounded-3xl border border-border bg-muted">
          <img src={c.cover} alt="" className="h-full w-full object-cover" />
        </div>
      </section>

      <article className="container-x max-w-3xl py-16 lg:py-20">
        <div className="space-y-12 text-base leading-8 text-foreground/85">
          <section>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Challenge</p>
            <h2 className="mt-3 text-2xl font-medium tracking-[-0.02em]">What was broken</h2>
            <p className="mt-4">{c.challenge}</p>
          </section>
          <section>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Solution</p>
            <h2 className="mt-3 text-2xl font-medium tracking-[-0.02em]">What we did together</h2>
            <p className="mt-4">{c.solution}</p>
          </section>
        </div>

        <div className="mt-16 rounded-3xl border border-border bg-card p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Results</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {c.results.map((r) => (
              <div key={r.label}>
                <p className="text-3xl font-medium tracking-tight">{r.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{r.label}</p>
                {r.detail && <p className="mt-1 text-xs text-muted-foreground/80">{r.detail}</p>}
              </div>
            ))}
          </div>
        </div>

        <blockquote className="mt-16 border-l-2 border-accent pl-5">
          <p className="text-xl font-medium leading-snug tracking-[-0.02em]">&ldquo;{c.quote}&rdquo;</p>
          <p className="mt-3 text-sm text-muted-foreground">— {c.quoteAuthor}</p>
        </blockquote>
      </article>

      {others.length > 0 && (
        <section className="bg-secondary/40 py-20">
          <div className="container-x">
            <h2 className="text-3xl font-medium tracking-[-0.04em] sm:text-4xl">More customer stories</h2>
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              {others.map((o) => (
                <Link
                  key={o.slug}
                  href={`/customers/${o.slug}`}
                  className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-card transition-shadow hover:shadow-md"
                >
                  <div className="aspect-[16/9] overflow-hidden bg-muted">
                    <img src={o.cover} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  </div>
                  <div className="p-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {o.industry} · {o.units}
                    </p>
                    <p className="mt-2 text-lg font-medium leading-tight">{o.name}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{o.summary}</p>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                      Read story <ArrowUpRight className="size-3.5" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="bg-accent text-accent-foreground py-16">
        <div className="container-x text-center">
          <h2 className="mx-auto max-w-2xl text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-4xl">
            Your name could be on this page.
          </h2>
          <Button
            asChild
            size="lg"
            className="mt-7 rounded-full bg-primary px-7 text-primary-foreground hover:bg-primary/90"
          >
            <Link href="/auth/sign-up">Start free <ArrowUpRight data-icon="inline-end" /></Link>
          </Button>
        </div>
      </section>
    </>
  )
}