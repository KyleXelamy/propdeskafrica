import type { Metadata } from "next"
import Link from "next/link"
import { ArrowUpRight, Database, Globe2, Lock } from "lucide-react"

export const metadata: Metadata = {
  title: "Data residency — I-Manage by Siemax Ltd",
  description: "Where your I-Manage data lives, how we keep it safe, and how to pin a region.",
}

const regions = [
  {
    flag: "🇪🇺",
    code: "EU-FRA",
    label: "Frankfurt, Germany",
    details: "EU-only customer data. GDPR-compliant by default. ISO 27001 certified facility.",
    available: ["Solo", "Pro", "Agency", "Enterprise"],
  },
  {
    flag: "🇰🇪",
    code: "KE-NBO",
    label: "Nairobi, Kenya",
    details: "Default for African customers. Local data residency for Kenya Data Protection Act compliance.",
    available: ["Solo", "Pro", "Agency", "Enterprise"],
  },
  {
    flag: "🇺🇸",
    code: "US-IAD",
    label: "Ashburn, United States",
    details: "Available for North American customers and certain procurement requirements.",
    available: ["Pro", "Agency", "Enterprise"],
  },
]

export default function DataPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_50%_30%,#d9f45b,transparent_55%)]" />
        <div className="container-x relative pt-32 pb-16 lg:pt-44">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Data</p>
          <h1 className="mt-6 max-w-3xl text-5xl font-medium leading-[0.98] tracking-[-0.05em] sm:text-7xl">
            Where your data lives.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-primary-foreground/70">
            You pick the region. Your data stays there. Cross-border transfers are explicit and logged.
          </p>
        </div>
      </section>

      <section className="bg-background py-16 lg:py-20">
        <div className="container-x">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Regions</p>
          <h2 className="mt-3 text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-4xl">
            Three regions. One product.
          </h2>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {regions.map((r) => (
              <div key={r.code} className="rounded-3xl border border-border bg-card p-6">
                <div className="text-4xl">{r.flag}</div>
                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{r.code}</p>
                <p className="mt-2 text-xl font-medium leading-tight">{r.label}</p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{r.details}</p>
                <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Available on</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {r.available.map((p) => (
                    <span key={p} className="rounded-full border border-border bg-background px-2.5 py-1 text-xs">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-secondary/40 py-20">
        <div className="container-x grid gap-8 md:grid-cols-3">
          {[
            { icon: Database, title: "Region-pinning", body: "Agency and Enterprise customers can pin a region. The platform never leaves it." },
            { icon: Lock, title: "Encryption", body: "AES-256 at rest, TLS 1.3 in transit. Per-tenant keys available on Enterprise." },
            { icon: Globe2, title: "Cross-border", body: "When transfers happen, we use Standard Contractual Clauses and log every event." },
          ].map((b) => (
            <div key={b.title} className="rounded-2xl border border-border bg-card p-6">
              <b.icon className="size-7 text-primary" />
              <p className="mt-8 text-lg font-medium leading-tight">{b.title}</p>
              <p className="mt-2 text-sm text-muted-foreground">{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-primary text-primary-foreground py-20">
        <div className="container-x text-center">
          <h2 className="mx-auto max-w-2xl text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-4xl">
            Have a procurement question?
          </h2>
          <Link
            href="/contact/sales"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-medium text-primary hover:bg-accent/90"
          >
            Talk to our security team <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </section>
    </>
  )
}