import type { Metadata } from "next"
import Link from "next/link"
import { ArrowUpRight, Mail, Phone, Calendar, Building2 } from "lucide-react"
import { MarketingSalesForm } from "@/components/marketing-sales-form"

export const metadata: Metadata = {
  title: "Contact sales — PropDesk Africa",
  description: "Talk to the PropDesk Africa team about Agency and Enterprise plans.",
}

export default function ContactSalesPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_30%_30%,#d9f45b,transparent_55%)]" />
        <div className="container-x relative pt-32 pb-16 lg:pt-44">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Sales</p>
          <h1 className="mt-6 max-w-3xl text-5xl font-medium leading-[0.98] tracking-[-0.05em] sm:text-7xl">
            Talk to our team about PropDesk Africa.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-primary-foreground/70">
            We&apos;ll learn your portfolio, recommend a plan, and walk you through a real setup.
            No pressure, no procurement theatre.
          </p>
        </div>
      </section>

      <section className="bg-background py-16 lg:py-20">
        <div className="container-x grid gap-12 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">What to expect</p>
            <h2 className="mt-3 text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-4xl">
              A 20-minute call, no slides.
            </h2>
            <ul className="mt-8 space-y-4">
              {[
                { icon: Building2, title: "We learn your portfolio", body: "How many units, what type, what you're spending today." },
                { icon: Calendar, title: "We propose a plan", body: "Solo, Pro, Agency or Enterprise — and a migration timeline." },
                { icon: Mail, title: "We send a proposal", body: "Pricing, scope, references — by email, within 48 hours." },
              ].map((it) => (
                <li key={it.title} className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-start gap-3">
                    <span className="grid size-9 place-items-center rounded-lg bg-secondary text-primary">
                      <it.icon className="size-4" />
                    </span>
                    <div>
                      <p className="text-base font-medium leading-tight">{it.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{it.body}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-10 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Direct lines</p>
              <p className="mt-3 flex items-center gap-2 text-foreground">
                <Mail className="size-4 text-primary" />
                <Link href="mailto:bknglabs.dev@gmail.com" className="text-primary underline">
                  bknglabs.dev@gmail.com
                </Link>
              </p>
              <p className="mt-2 flex items-center gap-2 text-foreground">
                <Phone className="size-4 text-primary" />
                +254 700 000 000
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-7 lg:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Book a call</p>
            <h2 className="mt-3 text-3xl font-medium leading-tight tracking-[-0.04em]">Tell us about your portfolio.</h2>
            <MarketingSalesForm />
          </div>
        </div>
      </section>
    </>
  )
}
