import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Quote } from "lucide-react"
import { testimonials, caseStudies } from "@/lib/content/site"

export const metadata: Metadata = {
  title: "Customers — I-Manage by Siemax Ltd",
  description:
    "Case studies and testimonials from landlords and agencies who run their portfolio on I-Manage.",
}

export default function CustomersPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_70%_20%,#d9f45b,transparent_55%)]" />
        <div className="container-x relative pt-40 pb-20 lg:pt-56 lg:pb-28">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Customers</p>
            <h1 className="mt-6 text-5xl font-medium leading-[0.98] tracking-[-0.05em] sm:text-7xl">
              The landlords we build for.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-primary-foreground/70">
              From a one-unit landlord with three flats in Kileleshwa to a 200-unit agency in Eldoret —
              here's how I-Manage shows up in their day.
            </p>
          </div>
        </div>
      </section>

      {/* Case studies */}
      <section className="bg-background py-20 lg:py-24">
        <div className="container-x">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Case studies</p>
          <h2 className="mt-4 text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-4xl">
            In their own words.
          </h2>

          <div className="mt-12 space-y-12">
            {caseStudies.map((cs) => (
              <article
                key={cs.slug}
                className="grid gap-8 overflow-hidden rounded-3xl border border-border bg-card lg:grid-cols-[1.1fr_1fr]"
              >
                <div className="aspect-[16/10] overflow-hidden bg-muted lg:aspect-auto">
                  <img src={cs.cover} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="flex flex-col justify-center p-8 lg:p-10">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    {cs.industry} · {cs.units} · {cs.location}
                  </p>
                  <h3 className="mt-3 text-2xl font-medium leading-tight tracking-[-0.03em] sm:text-3xl">
                    {cs.company}
                  </h3>
                  <p className="mt-4 text-base leading-7 text-foreground/85">{cs.summary}</p>

                  <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    {cs.results.map((r) => (
                      <div key={r.label}>
                        <p className="text-2xl font-medium tracking-tight">{r.value}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{r.label}</p>
                      </div>
                    ))}
                  </div>

                  <blockquote className="mt-8 border-l-2 border-accent pl-4">
                    <p className="text-sm leading-6 text-foreground/85">&ldquo;{cs.quote}&rdquo;</p>
                    <p className="mt-2 text-xs text-muted-foreground">— {cs.quoteAuthor}</p>
                  </blockquote>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-secondary/40 py-20 lg:py-24">
        <div className="container-x">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Testimonials</p>
          <h2 className="mt-4 text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-4xl">
            What customers say.
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {testimonials.map((t) => (
              <figure key={t.name} className="flex h-full flex-col rounded-3xl bg-card p-7">
                <Quote className="size-6 text-accent" />
                <blockquote className="mt-5 flex-1 text-sm leading-7 text-foreground/85">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3 border-t border-border pt-5">
                  <span className="grid size-10 place-items-center rounded-full bg-secondary text-sm font-medium text-primary">
                    {t.initials}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.role} · {t.company} · {t.location}
                    </p>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-accent text-accent-foreground py-20">
        <div className="container-x text-center">
          <h2 className="mx-auto max-w-2xl text-4xl font-medium leading-tight tracking-[-0.04em] sm:text-5xl">
            Your name could be on this page.
          </h2>
          <Link
            href="/auth/sign-up"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Start free <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

    </main>
  )
}