import type { Metadata } from "next"
import { SimpleMarketingPage, MarketingHome } from "@/components/marketing-site"
import { ArrowUpRight, Sparkles, ShieldCheck, Globe2, Heart, Building2 } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "About — I-Manage",
  description:
    "We're building the calm operating system for ambitious landlords and property teams across Africa. Meet the team behind I-Manage.",
}

const values = [
  {
    icon: ShieldCheck,
    eyebrow: "Trust by default",
    title: "Your portfolio data is yours. Full stop.",
    body: "Bank-grade encryption, row-level security, and a permission model that means only the people you choose ever see your numbers.",
  },
  {
    icon: Sparkles,
    eyebrow: "Calm by design",
    title: "Software should lower your blood pressure.",
    body: "We obsess over clarity. Less jargon. Cleaner dashboards. Decisions you can defend at dinner.",
  },
  {
    icon: Globe2,
    eyebrow: "Built for Africa",
    title: "Made where the work happens.",
    body: "Native M-Pesa, mobile-first, and timezone-aware. We ship for landlords in Nairobi, Lagos and beyond — not for Silicon Valley demos.",
  },
  {
    icon: Heart,
    eyebrow: "Long relationships",
    title: "We measure success in years, not weeks.",
    body: "No dark patterns, no surprise fees. We want to be the property platform you recommend to your neighbor.",
  },
]

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_top_right,#d9f45b,transparent_55%)]" />
        <div className="container-x relative pt-36 pb-24 lg:pt-48 lg:pb-32">
          <p className="mb-7 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-accent">
            <span className="h-px w-10 bg-accent" />
            About I-Manage
          </p>
          <h1 className="max-w-4xl text-5xl font-medium leading-[0.98] tracking-[-0.05em] sm:text-7xl lg:text-[88px]">
            We're building the <em className="font-serif font-normal text-accent">calm</em> behind a well-run portfolio.
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-8 text-primary-foreground/70">
            I-Manage is a Siemax Ltd product. We're a small team of engineers, designers and former
            landlords shipping the property platform we wished existed when we were doing the job ourselves.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="rounded-full bg-accent px-7 text-primary hover:bg-accent/90">
              <Link href="/auth/sign-up">Start managing <ArrowUpRight data-icon="inline-end" /></Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full border-primary-foreground/30 bg-transparent px-7 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <Link href="/contact">Talk to the team</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="bg-background py-20 lg:py-28">
        <div className="container-x grid gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Our story</p>
            <h2 className="mt-5 text-4xl font-medium leading-tight tracking-[-0.04em] sm:text-5xl">
              From a notebook to a national platform.
            </h2>
          </div>
          <div className="space-y-6 text-lg leading-8 text-muted-foreground">
            <p>
              I-Manage began with a simple question: why should running a property portfolio still feel
              like chasing spreadsheets and messages? We are building the clearer operating layer that
              owners and teams can rely on every day.
            </p>
            <p>
              The product is founded by Brian Kiarie and Esther Wangari, with a focus on practical tools,
              local payment habits, and respectful service for property teams.
            </p>
          </div>
        </div>
      </section>

      {/* Founders */}
      <section className="border-y border-border bg-card py-20 lg:py-24">
        <div className="container-x">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">The people behind I-Manage</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <article className="rounded-2xl border border-border bg-background p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Founder · CFO &amp; Operations</p>
              <h2 className="mt-3 text-2xl font-medium tracking-[-0.03em]">Brian Kiarie</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">Leads the operating model, financial discipline and day-to-day execution behind the product.</p>
            </article>
            <article className="rounded-2xl border border-border bg-background p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Founder</p>
              <h2 className="mt-3 text-2xl font-medium tracking-[-0.03em]">Esther Wangari</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">Helps shape the product, customer experience and direction of the platform.</p>
            </article>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="bg-secondary/40 py-24 lg:py-32">
        <div className="container-x">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">What we believe</p>
            <h2 className="mt-5 text-4xl font-medium leading-tight tracking-[-0.04em] sm:text-6xl">
              Four values we won't compromise.
            </h2>
          </div>
          <div className="mt-16 grid gap-px overflow-hidden rounded-3xl bg-border md:grid-cols-2">
            {values.map(({ icon: Icon, eyebrow, title, body }) => (
              <article key={title} className="bg-card p-8 lg:p-10">
                <div className="flex items-center justify-between">
                  <Icon className="size-8 text-primary" strokeWidth={1.5} />
                </div>
                <p className="mt-12 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p>
                <h3 className="mt-4 text-2xl font-medium leading-tight tracking-[-0.03em]">{title}</h3>
                <p className="mt-4 text-base leading-7 text-muted-foreground">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Numbers */}
      <section className="bg-primary text-primary-foreground py-20 lg:py-24">
        <div className="container-x">
          <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { k: "2,500+", v: "Properties under management" },
              { k: "KES 150M+", v: "Rent processed annually" },
              { k: "94.8%", v: "Average on-time collection rate" },
              { k: "12", v: "Cities served today" },
            ].map((s) => (
              <div key={s.k}>
                <p className="text-4xl font-medium tracking-tight text-accent lg:text-5xl">{s.k}</p>
                <p className="mt-3 text-sm text-primary-foreground/65">{s.v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-accent text-accent-foreground py-20 lg:py-28">
        <div className="container-x text-center">
          <Building2 className="mx-auto size-10" />
          <h2 className="mx-auto mt-6 max-w-3xl text-4xl font-medium leading-tight tracking-[-0.05em] sm:text-6xl">
            Join the landlords who run their portfolio like a business.
          </h2>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="rounded-full bg-primary px-7 text-primary-foreground hover:bg-primary/90">
              <Link href="/auth/sign-up">Start managing <ArrowUpRight data-icon="inline-end" /></Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full border-primary/30 px-7"
            >
              <Link href="/pricing">See pricing</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}
