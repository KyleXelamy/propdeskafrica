import type { Metadata } from "next"
import Link from "next/link"
import { ArrowUpRight, Lock, KeyRound, Eye, Server, FileCheck2, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Security — I-Manage by Siemax Ltd",
  description:
    "How I-Manage protects your data — encryption, access controls, infrastructure, compliance and how to report a vulnerability.",
}

const principles = [
  {
    icon: Lock,
    title: "Encrypted everywhere",
    body: "TLS 1.3 in transit. AES-256 at rest. Per-tenant encryption keys in our roadmap.",
  },
  {
    icon: KeyRound,
    title: "Least-privilege access",
    body: "Row-level security on every Supabase table. Staff access is logged and time-limited.",
  },
  {
    icon: Eye,
    title: "You own your data",
    body: "Export or delete every record at any time. We never sell, rent, or share your data.",
  },
  {
    icon: Server,
    title: "Resilient by default",
    body: "99.9% uptime target. Daily encrypted backups, multi-region failover on the Agency tier.",
  },
  {
    icon: FileCheck2,
    title: "Audit logs",
    body: "Every sensitive action — login, export, payment, deletion — leaves a tamper-evident trail.",
  },
  {
    icon: Mail,
    title: "Responsible disclosure",
    body: "Found a vulnerability? Email security@i-manage.app and we'll respond within 48 hours.",
  },
]

const compliance = [
  { label: "GDPR-aligned data handling", detail: "Documented data flows, DSAR support, EU SCCs." },
  { label: "CCPA-aligned data handling", detail: "Right to know, delete, and opt out of sale (we never sell)." },
  { label: "Safaricom Daraja compliance", detail: "PCI scope minimised — we never touch card data or M-Pesa PINs." },
  { label: "SOC 2 Type II", detail: "In progress — expected Q2 2027." },
]

export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_30%_30%,#d9f45b,transparent_55%)]" />
        <div className="container-x relative pt-40 pb-20 lg:pt-56 lg:pb-28">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Security</p>
            <h1 className="mt-6 text-5xl font-medium leading-[0.98] tracking-[-0.05em] sm:text-7xl">
              Trust, by default.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-primary-foreground/70">
              Your portfolio data is the most sensitive thing on the platform. Here's exactly how we
              protect it — and how to tell us if we ever fall short.
            </p>
          </div>
        </div>
      </section>

      {/* Principles */}
      <section className="bg-background py-20 lg:py-24">
        <div className="container-x">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Principles</p>
            <h2 className="mt-5 text-4xl font-medium leading-tight tracking-[-0.04em] sm:text-5xl">
              What we promise, in plain language.
            </h2>
          </div>
          <div className="mt-14 grid gap-px overflow-hidden rounded-3xl bg-border md:grid-cols-2 lg:grid-cols-3">
            {principles.map(({ icon: Icon, title, body }) => (
              <article key={title} className="bg-card p-8">
                <Icon className="size-7 text-primary" strokeWidth={1.5} />
                <h3 className="mt-10 text-xl font-medium leading-tight tracking-[-0.03em]">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance */}
      <section className="bg-secondary/40 py-20 lg:py-24">
        <div className="container-x">
          <div className="grid gap-12 lg:grid-cols-[.85fr_1.15fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Compliance</p>
              <h2 className="mt-5 text-4xl font-medium leading-tight tracking-[-0.04em] sm:text-5xl">
                Frameworks we work with.
              </h2>
              <p className="mt-5 max-w-md text-base leading-7 text-muted-foreground">
                We're a small team and we don't have every certification on day one. Here's an honest
                list — and what's on our roadmap.
              </p>
            </div>
            <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
              {compliance.map((c) => (
                <li key={c.label} className="p-6">
                  <p className="text-base font-medium">{c.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{c.detail}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Report vulnerability */}
      <section className="bg-primary text-primary-foreground py-20">
        <div className="container-x grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Responsible disclosure</p>
            <h2 className="mt-5 text-4xl font-medium leading-tight tracking-[-0.04em] sm:text-5xl">
              Found a vulnerability? Tell us.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-primary-foreground/70">
              We take every report seriously. Email us, give us a reasonable window to fix it before
              any public disclosure, and we'll send you a thank-you and a bounty where applicable.
            </p>
            <Button
              asChild
              size="lg"
              className="mt-8 rounded-full bg-accent px-7 text-primary hover:bg-accent/90"
            >
              <Link href="mailto:security@i-manage.app">
                security@i-manage.app <ArrowUpRight className="ml-1 size-4" />
              </Link>
            </Button>
          </div>
          <div className="rounded-3xl border border-primary-foreground/10 bg-primary-foreground/5 p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">PGP key</p>
            <p className="mt-3 break-all font-mono text-xs text-primary-foreground/65">
              0x3F2A 4B6C 9D1E 7F8A 1C5B 6E9D 2A3B 8F4D
            </p>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-accent">Response time</p>
            <p className="mt-3 text-base text-primary-foreground/75">
              Within 48 hours for all reports, 24 hours for critical findings.
            </p>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-accent">Bounty</p>
            <p className="mt-3 text-base text-primary-foreground/75">
              KES 5,000 — KES 250,000 depending on severity. Paid via M-Pesa or bank transfer.
            </p>
          </div>
        </div>
      </section>

    </main>
  )
}