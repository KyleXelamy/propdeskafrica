import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, ArrowUpRight, BookOpen, MessageSquare, Mail } from "lucide-react"

export const metadata: Metadata = {
  title: "Help & FAQ — I-Manage",
  description:
    "Common questions, getting started guides and how to contact the I-Manage support team.",
}

const categories = [
  {
    title: "Getting started",
    items: [
      {
        q: "How do I create my first property?",
        a: "After signing in, head to Dashboard → Properties → New. The form takes about 2 minutes per unit and supports photos, amenities and rent schedules.",
      },
      {
        q: "Can I import from a spreadsheet?",
        a: "Yes — Properties, Tenants and Payments all support CSV import. Export from your current tool, walk through the field mapping, and we'll validate every row.",
      },
      {
        q: "Do I need a payment provider to use I-Manage?",
        a: "No. You can log rent manually without ever touching M-Pesa. STK Push is opt-in per tenant.",
      },
    ],
  },
  {
    title: "M-Pesa & payments",
    items: [
      {
        q: "Which M-Pesa API do you use?",
        a: "Safaricom's Daraja STK Push for collection and B2C for refunds. We never see or store a tenant's PIN.",
      },
      {
        q: "What happens if a tenant cancels the STK Push?",
        a: "We log the cancellation event with timestamp. You can trigger a fresh push from the tenant's profile or set up automatic retry with consent.",
      },
      {
        q: "Do you support Airtel Money?",
        a: "Yes — Airtel Money is live across Kenya, Uganda, Tanzania and Rwanda.",
      },
    ],
  },
  {
    title: "Billing & accounts",
    items: [
      {
        q: "Can I change plans later?",
        a: "Anytime. Upgrade is immediate; downgrade takes effect at the next billing cycle.",
      },
      {
        q: "Do you offer a non-profit discount?",
        a: "Yes — 50% off for registered non-profits and student landlords. Email bknglabs.dev@gmail.com.",
      },
      {
        q: "How do I cancel?",
        a: "Settings → Billing → Cancel. You'll keep access through the end of the period and can export your data first.",
      },
    ],
  },
  {
    title: "Security & privacy",
    items: [
      {
        q: "Where is my data stored?",
        a: "Supabase (PostgreSQL) on AWS, in the EU (Frankfurt) and Kenya (Nairobi) regions. Region selection is available on the Agency plan.",
      },
      {
        q: "Can I delete my account and data?",
        a: "Yes — Settings → Data → Delete account. We delete within 30 days, except records we're legally required to keep.",
      },
      {
        q: "Do you sell my data?",
        a: "Never. Our business model is subscriptions, not data.",
      },
    ],
  },
]

export default function HelpPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_70%_30%,#d9f45b,transparent_55%)]" />
        <div className="container-x relative pt-40 pb-20 lg:pt-56 lg:pb-28">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Help center</p>
            <h1 className="mt-6 text-5xl font-medium leading-[0.98] tracking-[-0.05em] sm:text-7xl">
              How can we help?
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-primary-foreground/70">
              Search the most common questions, or skip ahead and message a human.
            </p>
          </div>
        </div>
      </section>

      {/* Contact strip */}
      <section className="bg-background py-12">
        <div className="container-x">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: BookOpen,
                title: "Read the guides",
                body: "Step-by-step playbooks for every workflow.",
                href: "/resources",
                cta: "Browse resources",
              },
              {
                icon: MessageSquare,
                title: "Chat with the team",
                body: "Live chat for Pro & Agency customers, 9am–9pm EAT.",
                href: "/contact",
                cta: "Start a conversation",
              },
              {
                icon: Mail,
                title: "Email support",
                body: "We reply to every email within one business day.",
                href: "mailto:bknglabs.dev@gmail.com",
                cta: "bknglabs.dev@gmail.com",
              },
            ].map((c) => (
              <Link
                key={c.title}
                href={c.href}
                className="group flex items-start gap-4 rounded-2xl border border-border bg-card p-6 transition-shadow hover:border-primary"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-primary">
                  <c.icon className="size-4" />
                </span>
                <div>
                  <p className="text-base font-medium">{c.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{c.body}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
                    {c.cta} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-secondary/40 py-20 lg:py-24">
        <div className="container-x max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">FAQ</p>
          <h2 className="mt-4 text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-4xl">
            Common questions, clear answers.
          </h2>

          <div className="mt-12 space-y-12">
            {categories.map((cat) => (
              <div key={cat.title}>
                <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  {cat.title}
                </h3>
                <div className="mt-4 divide-y divide-border rounded-2xl border border-border bg-card">
                  {cat.items.map((f) => (
                    <details key={f.q} className="group p-6">
                      <summary className="flex cursor-pointer items-center justify-between gap-6 text-left text-base font-medium [&::-webkit-details-marker]:hidden">
                        <span>{f.q}</span>
                        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                      </summary>
                      <p className="mt-4 text-sm leading-7 text-muted-foreground">{f.a}</p>
                    </details>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 rounded-2xl border border-border bg-card p-8 text-center">
            <p className="text-base font-medium">Still stuck?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Real humans, real answers — usually within the hour.
            </p>
            <Link
              href="/contact"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Contact the team <ArrowUpRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

    </main>
  )
}
