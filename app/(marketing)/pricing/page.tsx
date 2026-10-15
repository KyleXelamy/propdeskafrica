import type { Metadata } from "next"
import Link from "next/link"
import { ArrowUpRight, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PLANS, formatPrice, MONTHLY_PRICE_KES, TRIAL_DAYS } from "@/lib/pricing"

export const metadata: Metadata = {
  title: "Pricing — PropDesk Africa",
  description:
    "Simple, transparent pricing for landlords and property teams. Start free, scale as you grow.",
}


const faqs = [
  {
    q: "Can I cancel anytime?",
    a: "Yes. No contracts, no claw-backs. Cancel from your dashboard and you’ll keep access through the end of your billing period.",
  },
  {
    q: "Do you charge transaction fees on M-Pesa?",
    a: "We pass through Daraja's standard STK Push fees. PropDesk Africa itself does not take a percentage.",
  },
  {
    q:     "What happens after the trial?",
    a: `Your ${TRIAL_DAYS}-day trial includes the complete PropDesk Africa workspace. After the trial, the subscription is KES ${MONTHLY_PRICE_KES.toLocaleString("en-KE")} per month for any portfolio size.`,
  },
  {
    q: "Can I import from my current tool?",
    a: "Yes. CSV import covers properties, tenants and payments. For a larger migration we can run the import for you.",
  },
  {
    q: "Is there a student or non-profit discount?",
    a: "Tell us who you are. We would rather help a landlord maintain a property than lose them to a spreadsheet.",
  },
]

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-[0.06] bg-[radial-gradient(circle_at_50%_120%,#d9f45b,transparent_60%)]" />
        <div className="container-x relative pt-40 pb-20 lg:pt-56 lg:pb-28">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Pricing</p>
            <h1 className="mt-6 text-5xl font-medium leading-[0.98] tracking-[-0.05em] sm:text-7xl">
              Honest plans. No surprises.
            </h1>
            <p className="mx-auto mt-7 max-w-xl text-lg leading-8 text-primary-foreground/70">
              Start with a complete {TRIAL_DAYS}-day trial. Then pay one flat monthly price, whether
              you manage 3 units or 100. No setup fees, no per-feature locks, no percentage of your rent.
            </p>
          </div>
        </div>
      </section>

      {/* Tiers */}
      <section className="bg-background py-16 lg:py-24">
        <div className="container-x">
          <div className="grid gap-6 lg:grid-cols-2">
            {PLANS.map((tier) => (
              <div
                key={tier.code}
                className={
                  "relative flex flex-col rounded-3xl border p-8 lg:p-10 transition-shadow " +
                  (tier.highlight
                    ? "border-primary bg-card shadow-xl lg:scale-[1.03]"
                    : "border-border bg-card")
                }
              >
                {tier.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-accent-foreground">
                    Recommended starting point
                  </span>
                )}
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{tier.name}</p>
                <div className="mt-6 flex items-baseline gap-2">
                  <span className="text-4xl font-medium tracking-tight lg:text-5xl">{formatPrice(tier.price)}</span>
                  <span className="text-sm text-muted-foreground">{tier.cadence}</span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{tier.tagline}</p>
                <Button
                  asChild
                  size="lg"
                  className={
                    "mt-8 rounded-full " +
                    (tier.highlight
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80")
                  }
                >
                  <Link href={tier.href}>
                    {tier.cta} <ArrowUpRight data-icon="inline-end" />
                  </Link>
                </Button>
                <ul className="mt-8 space-y-3 text-sm">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                        <Check className="size-3" />
                      </span>
                      <span className="leading-6">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <p className="mt-10 text-center text-sm text-muted-foreground">
            One price for everyone: KES {MONTHLY_PRICE_KES.toLocaleString('en-KE')} a month after your {TRIAL_DAYS}-day trial. The same price whether you manage 3 units or 100. No tier to outgrow, no feature locks, and no percentage of your rent.
          </p>
        </div>
      </section>

      {/* Compare callout */}
      <section className="bg-secondary/40 py-20 lg:py-24">
        <div className="container-x grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">What you don't pay for</p>
            <h2 className="mt-5 text-4xl font-medium leading-tight tracking-[-0.04em] sm:text-5xl">
              We don't take a cut of your rent.
            </h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              Most property platforms charge you 1–3% on top of every rent transaction. We think that's
              wrong — it punishes you for growing. PropDesk Africa is a flat monthly price, full stop.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { k: "0%", v: "Transaction fees on rent" },
              { k: "0", v: "Setup or onboarding fees" },
              { k: "0", v: "Per-feature paywalls" },
              { k: "≤ 24h", v: "Support response" },
            ].map((s) => (
              <div key={s.k} className="rounded-2xl bg-card p-5">
                <p className="text-3xl font-medium tracking-tight">{s.k}</p>
                <p className="mt-2 text-sm text-muted-foreground">{s.v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-background py-20 lg:py-28">
        <div className="container-x max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">FAQ</p>
          <h2 className="mt-5 text-4xl font-medium leading-tight tracking-[-0.04em] sm:text-5xl">
            Questions, answered straight.
          </h2>
          <div className="mt-12 divide-y divide-border rounded-2xl border border-border bg-card">
            {faqs.map((f) => (
              <details key={f.q} className="group p-6">
                <summary className="flex cursor-pointer items-center justify-between gap-6 text-left text-base font-medium [&::-webkit-details-marker]:hidden">
                  <span>{f.q}</span>
                  <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                </summary>
                <p className="mt-4 text-sm leading-7 text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
          <p className="mt-10 text-sm text-muted-foreground">
            Still on the fence? <Link href="/contact" className="font-medium text-foreground underline">Talk to a human →</Link>
          </p>
        </div>
      </section>

    </main>
  )
}
