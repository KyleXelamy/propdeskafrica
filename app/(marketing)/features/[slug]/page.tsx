import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowUpRight, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { features } from "@/lib/content/marketing"
import * as Icons from "lucide-react"

export function generateStaticParams() {
  return features.map((f) => ({ slug: f.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const feature = features.find((f) => f.slug === slug)
  if (!feature) return { title: "Feature — PropDesk Africa" }
  return {
    title: `${feature.name} — PropDesk Africa`,
    description: feature.summary,
    openGraph: feature.image ? { images: [feature.image] } : undefined,
  }
}

export default async function FeaturePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const feature = features.find((f) => f.slug === slug)
  if (!feature) notFound()
  const Icon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[feature.icon]
  const others = features.filter((f) => f.slug !== feature.slug).slice(0, 3)

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_30%_30%,#d9f45b,transparent_55%)]" />
        <div className="container-x relative pt-32 pb-16 lg:pt-44 lg:pb-24">
          <Link
            href="/features"
            className="text-xs font-semibold uppercase tracking-[0.22em] text-accent/90 hover:text-accent"
          >
            ← All features
          </Link>
          <div className="mt-8 flex items-center gap-4">
            <span className="grid size-12 place-items-center rounded-2xl bg-primary-foreground/10 text-accent">
              {Icon ? <Icon className="size-6" /> : null}
            </span>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Feature</p>
          </div>
          <h1 className="mt-6 max-w-3xl text-5xl font-medium leading-[0.98] tracking-[-0.05em] sm:text-7xl">
            {feature.name}
          </h1>
          <p className="mt-5 max-w-2xl text-xl text-primary-foreground/80">{feature.tagline}</p>
          <p className="mt-6 max-w-2xl text-base leading-7 text-primary-foreground/65">{feature.summary}</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="rounded-full bg-accent px-7 text-primary hover:bg-accent/90">
              <Link href="/auth/sign-up">Start free <ArrowUpRight data-icon="inline-end" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full border-primary-foreground/30 bg-transparent px-7 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
              <Link href="/pricing">See pricing</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Cover */}
      {feature.image && (
        <div className="container-x -mt-1">
          <div className="aspect-[16/8] overflow-hidden rounded-3xl border border-border bg-muted">
            <img src={feature.image} alt="" className="h-full w-full object-cover" />
          </div>
        </div>
      )}

      {/* Bullets */}
      <section className="bg-background py-16 lg:py-24">
        <div className="container-x max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">What's included</p>
          <h2 className="mt-4 text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-4xl">
            Everything in {feature.name}.
          </h2>
          <ul className="mt-10 space-y-4">
            {feature.bullets.map((b) => (
              <li key={b} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3" />
                </span>
                <span className="text-base leading-6">{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Other features */}
      <section className="bg-secondary/40 py-20 lg:py-24">
        <div className="container-x">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Explore more</p>
          <h2 className="mt-4 text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-4xl">
            Pairs well with {feature.name}.
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {others.map((o) => {
              const OIcon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[o.icon]
              return (
                <Link
                  key={o.slug}
                  href={`/features/${o.slug}`}
                  className="group flex flex-col rounded-3xl border border-border bg-card p-6 transition-shadow hover:shadow-md"
                >
                  <span className="grid size-10 place-items-center rounded-2xl bg-secondary text-primary">
                    {OIcon ? <OIcon className="size-5" /> : null}
                  </span>
                  <p className="mt-8 text-lg font-medium leading-tight">{o.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{o.tagline}</p>
                  <span className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-primary">
                    Read more <ArrowUpRight className="size-3.5" />
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </section>
    </>
  )
}