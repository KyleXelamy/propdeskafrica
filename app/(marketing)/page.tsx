import Link from "next/link"
import {
  ArrowRight, ArrowUpRight, BarChart3, Banknote, Building2, Check, ChevronRight, CircleDollarSign,
  FileText, Layers, Lock, MessageSquare, Receipt, ShieldCheck, Smartphone, Sparkles, Users, Wrench,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { features } from "@/lib/content/marketing"
import { testimonials } from "@/lib/content/site"
import * as Icons from "lucide-react"

const featureIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  Banknote, Users, Wrench, FileText, BarChart3, Receipt, Building2, Layers,
}

const trustLogos = [
  "Highland Estates", "Coast Living", "Kibera Co-op", "Riverside Apartments",
  "Greenfield Group", "Skyline Realty", "Pamoja Property", "Maridadi Homes",
]

export default function MarketingHome() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(21,35,29,.98)_12%,rgba(21,35,29,.72)_52%,rgba(21,35,29,.18)),url('https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=2200&q=85')] bg-cover bg-center" />
        <div className="container-x relative grid min-h-[720px] max-w-[1320px] items-end pt-36 pb-20 lg:px-10 lg:pb-28">
          <div className="max-w-3xl">
            <p className="mb-7 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-accent">
              <span className="h-px w-10 bg-accent" />
              The holy grail for landlords &amp; agents
            </p>
            <h1 className="max-w-4xl text-5xl font-medium leading-[.98] tracking-[-0.055em] sm:text-7xl lg:text-[92px]">
              Run your <em className="font-serif font-normal text-accent">entire portfolio</em> from one place.
            </h1>
            <p className="mt-8 max-w-xl text-base leading-7 text-white/70 sm:text-lg">
              I-Manage is the landlord &amp; agent control room. Properties, tenants, rent, maintenance,
              quotations, damages, documents and contacts — every workflow your business does, in one
              workspace. Your tenants just pay your paybill; the rest is yours.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="rounded-full bg-accent px-7 text-primary hover:bg-accent/90">
                <Link href="/auth/sign-up">Build your portfolio <ArrowUpRight data-icon="inline-end" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full border-white/30 bg-transparent px-7 text-white hover:bg-white/10 hover:text-white">
                <Link href="#platform">Explore the platform <ChevronRight data-icon="inline-end" /></Link>
              </Button>
            </div>
            <p className="mt-6 text-xs text-white/55">
              Free up to 3 units. No credit card. No phone calls.
            </p>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="border-y border-border bg-background py-10">
        <div className="container-x">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Trusted by 40 landlords across 12 cities
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {trustLogos.map((l) => (
              <span key={l} className="text-sm font-medium text-muted-foreground/80">{l}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Problem / Solution */}
      <section className="bg-secondary/40 py-24 lg:py-32">
        <div className="container-x">
          <div className="grid gap-12 lg:grid-cols-[.85fr_1.15fr] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">One operating system</p>
              <h2 className="mt-5 max-w-xl text-4xl font-medium leading-tight tracking-[-0.04em] sm:text-6xl">
                The calm behind a well-run portfolio.
              </h2>
            </div>
            <p className="max-w-md text-base leading-7 text-muted-foreground">
              From your first unit to your next hundred, I-Manage brings the financial, operational
              and human sides of property into one thoughtful workspace.
            </p>
          </div>
          <div className="mt-20 grid gap-px overflow-hidden rounded-3xl bg-border md:grid-cols-3">
            {[
              { icon: Building2, eyebrow: "Portfolio command", title: "Every property. One clear view.", body: "Move from scattered spreadsheets to a live operating picture of your entire portfolio." },
              { icon: CircleDollarSign, eyebrow: "Cashflow intelligence", title: "Know what is happening with your money.", body: "Track rent, expenses, arrears and performance without waiting for month-end." },
              { icon: ShieldCheck, eyebrow: "Operational control", title: "Run the day-to-day with confidence.", body: "Keep leases, documents, maintenance and team activity connected and accountable." },
            ].map(({ icon: Icon, eyebrow, title, body }, i) => (
              <article key={title} className="bg-background p-8 lg:p-10">
                <div className="flex items-center justify-between">
                  <Icon className="size-8 text-primary" strokeWidth={1.5} />
                  <span className="text-xs text-muted-foreground">0{i + 1}</span>
                </div>
                <p className="mt-16 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p>
                <h3 className="mt-4 text-2xl font-medium leading-tight tracking-[-0.03em]">{title}</h3>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Feature deep-dives */}
      <section id="platform" className="bg-background py-24 lg:py-32">
        <div className="container-x">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">The platform</p>
            <h2 className="mt-4 text-4xl font-medium leading-tight tracking-[-0.04em] sm:text-6xl">
              Eight products. One workspace.
            </h2>
            <p className="mt-5 text-base leading-7 text-muted-foreground">
              Every workflow a landlord does weekly, designed to feel like one product — not eight
              tools you have to glue together.
            </p>
          </div>
          <div className="mt-16 space-y-10">
            {features.slice(0, 4).map((f, i) => {
              const Icon = featureIcons[f.icon] ?? Sparkles
              const reverse = i % 2 === 1
              return (
                <div
                  key={f.slug}
                  className="grid items-center gap-10 rounded-3xl border border-border bg-card p-6 lg:grid-cols-2 lg:gap-16 lg:p-10"
                >
                  <div className={reverse ? "lg:order-2" : ""}>
                    <span className="grid size-12 place-items-center rounded-2xl bg-secondary text-primary">
                      <Icon className="size-5" />
                    </span>
                    <h3 className="mt-8 text-3xl font-medium leading-tight tracking-[-0.03em]">{f.name}</h3>
                    <p className="mt-3 text-base font-medium text-primary">{f.tagline}</p>
                    <p className="mt-4 text-base leading-7 text-muted-foreground">{f.summary}</p>
                    <Link
                      href={`/features/${f.slug}`}
                      className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                    >
                      Learn more <ArrowUpRight className="size-3.5" />
                    </Link>
                  </div>
                  {f.image && (
                    <div className={reverse ? "lg:order-1" : ""}>
                      <div className="aspect-[16/10] overflow-hidden rounded-2xl bg-muted">
                        <img src={f.image} alt="" className="h-full w-full object-cover" />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="mt-10 text-center">
            <Link
              href="/features"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-medium hover:border-primary hover:text-primary"
            >
              See all features <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-primary text-primary-foreground py-24 lg:py-32">
        <div className="container-x">
          <div className="grid gap-12 lg:grid-cols-[.85fr_1.15fr] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">In their words</p>
              <h2 className="mt-4 text-4xl font-medium leading-tight tracking-[-0.04em] sm:text-6xl">
                Loved by landlords.
              </h2>
            </div>
            <p className="max-w-md text-base leading-7 text-primary-foreground/65">
              4.8 / 5 from 800+ reviews. Rated #1 for rent collection in our market.
            </p>
          </div>
          <div className="mt-16 grid gap-5 md:grid-cols-3">
            {testimonials.map((t) => (
              <figure key={t.name} className="flex h-full flex-col rounded-3xl border border-primary-foreground/10 bg-primary-foreground/5 p-7">
                <p className="flex-1 text-sm leading-7 text-primary-foreground/85">&ldquo;{t.quote}&rdquo;</p>
                <figcaption className="mt-6 flex items-center gap-3 border-t border-primary-foreground/10 pt-5">
                  <span className="grid size-10 place-items-center rounded-full bg-accent text-sm font-medium text-primary">
                    {t.initials}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-primary-foreground">{t.name}</p>
                    <p className="text-xs text-primary-foreground/55">{t.role} · {t.company} · {t.location}</p>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
          <div className="mt-12 text-center">
            <Link
              href="/customers"
              className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 px-6 py-3 text-sm font-medium hover:bg-primary-foreground/10"
            >
              Read customer stories <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="bg-background py-24 lg:py-32">
        <div className="container-x">
          <div className="grid gap-12 lg:grid-cols-[.85fr_1.15fr] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Pricing</p>
              <h2 className="mt-4 text-4xl font-medium leading-tight tracking-[-0.04em] sm:text-6xl">
                Honest plans. No surprises.
              </h2>
            </div>
            <p className="max-w-md text-base leading-7 text-muted-foreground">
              Start free. Upgrade when your portfolio does. We don&apos;t take a percentage of your rent.
            </p>
          </div>
          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {[
              { name: "Solo", price: "Free", cadence: "Up to 3 units", cta: "Start free" },
              { name: "Pro", price: "KES 2,490", cadence: "per month", cta: "Start 14-day trial", highlight: true },
              { name: "Agency", price: "Talk to us", cadence: "tailored", cta: "Book a call" },
            ].map((t) => (
              <div
                key={t.name}
                className={
                  "rounded-3xl border p-7 lg:p-8 " +
                  (t.highlight ? "border-primary bg-card shadow-xl" : "border-border bg-card")
                }
              >
                {t.highlight && (
                  <span className="inline-block rounded-full bg-accent px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-accent-foreground">
                    Most popular
                  </span>
                )}
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{t.name}</p>
                <p className="mt-3 text-3xl font-medium tracking-tight">{t.price}</p>
                <p className="text-sm text-muted-foreground">{t.cadence}</p>
                <Link
                  href={t.name === "Agency" ? "/contact/sales" : "/auth/sign-up"}
                  className={
                    "mt-7 block rounded-full px-5 py-2.5 text-center text-sm font-medium " +
                    (t.highlight
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border border-border hover:border-primary hover:text-primary")
                  }
                >
                  {t.cta}
                </Link>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              See full pricing comparison <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-accent text-accent-foreground py-24 lg:py-32">
        <div className="container-x text-center">
          <Sparkles className="mx-auto size-8" />
          <h2 className="mx-auto mt-6 max-w-3xl text-4xl font-medium leading-tight tracking-[-0.05em] sm:text-6xl">
            A better way to own what comes next.
          </h2>
          <p className="mx-auto mt-6 max-w-lg text-base leading-7 text-accent-foreground/85">
            Start with a clearer view of today, then build the portfolio you want tomorrow.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="rounded-full bg-primary px-7 text-primary-foreground hover:bg-primary/90">
              <Link href="/auth/sign-up">Start managing <ArrowUpRight data-icon="inline-end" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full border-primary/20 px-7">
              <Link href="/contact/sales">Talk to our team</Link>
            </Button>
          </div>
          <p className="mt-8 text-xs text-accent-foreground/65">
            No credit card. No "free trial expiring soon." Just the product.
          </p>
        </div>
      </section>
    </>
  )
}
