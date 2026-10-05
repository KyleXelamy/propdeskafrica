import type { Metadata } from "next"
import Link from "next/link"
import { ArrowUpRight, Download, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Press — I-Manage by Siemax Ltd",
  description:
    "Press kit, brand assets, coverage and contact for journalists covering I-Manage.",
}

const assets = [
  { name: "I-Manage icon (SVG)", size: "Vector logo", href: "/icon.svg", download: true },
  { name: "I-Manage icon (PNG)", size: "32 × 32 PNG", href: "/icon-light-32x32.png", download: true },
  { name: "Brand guidelines", size: "Text document", href: "/press/brand-guidelines.txt", download: true },
  { name: "Company fact sheet", size: "Text document", href: "/press/company-fact-sheet.txt", download: true },
  { name: "Landlord templates", size: "12 downloadable templates", href: "/templates", download: false },
]

export default function PressPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_50%_30%,#d9f45b,transparent_55%)]" />
        <div className="container-x relative pt-40 pb-20 lg:pt-56 lg:pb-28">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Press</p>
            <h1 className="mt-6 text-5xl font-medium leading-[0.98] tracking-[-0.05em] sm:text-7xl">
              Press, media & brand assets.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-primary-foreground/70">
              Everything you need to write about I-Manage. Reach out — we respond to press inquiries
              within four hours.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="rounded-full bg-accent px-7 text-primary hover:bg-accent/90">
                <Link href="mailto:bknglabs.dev@gmail.com">
                  <Mail className="mr-2 size-4" /> bknglabs.dev@gmail.com
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full border-primary-foreground/30 bg-transparent px-7 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                <Link href="#kit">
                  <Download className="mr-2 size-4" /> Download the press kit
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Numbers */}
      <section className="bg-background py-16">
        <div className="container-x grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {[
  { k: "Kenya-first", v: "Built for local property teams" },
  { k: "M-Pesa ready", v: "Designed around familiar payments" },
  { k: "12 templates", v: "Practical landlord resources" },
  { k: "Siemax Ltd", v: "I-Manage product team" },
          ].map((s) => (
            <div key={s.k}>
              <p className="text-3xl font-medium tracking-tight sm:text-4xl">{s.k}</p>
              <p className="mt-2 text-sm text-muted-foreground">{s.v}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Coverage */}
      <section className="bg-secondary/40 py-20 lg:py-24">
        <div className="container-x">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Media enquiries</p>
          <h2 className="mt-4 max-w-2xl text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-4xl">
            A clear source for I-Manage information.
          </h2>
          <div className="mt-10 rounded-2xl border border-border bg-card p-6 sm:p-8">
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              We are building our press library and do not list third-party coverage until it has been confirmed and published. For current product information, interviews, or approved screenshots, contact the Siemax Ltd team directly.
            </p>
            <Button asChild variant="outline" className="mt-6 rounded-full">
              <Link href="mailto:bknglabs.dev@gmail.com?subject=I-Manage%20press%20enquiry">
                Email the press desk <ArrowUpRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Press kit */}
      <section id="kit" className="bg-background py-20 lg:py-24">
        <div className="container-x">
          <div className="grid gap-12 lg:grid-cols-[.9fr_1.1fr] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Press kit</p>
              <h2 className="mt-5 text-4xl font-medium leading-tight tracking-[-0.04em] sm:text-5xl">
                Download everything you need.
              </h2>
            </div>
            <p className="text-base leading-7 text-muted-foreground">
              Logos, founder photos and product screenshots in a single zip. Please don't modify
              the logos or stretch them out of proportion. Brand guidelines included.
            </p>
          </div>

          <ul className="mt-12 divide-y divide-border rounded-2xl border border-border bg-card">
            {assets.map((a) => (
              <li key={a.name} className="flex items-center justify-between gap-4 p-6">
                <div>
                  <p className="text-sm font-medium">{a.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{a.size}</p>
                </div>
                <Button asChild variant="ghost" size="sm" className="rounded-full text-primary">
                  <a href={a.href} download={a.download ? "" : undefined}>
                    <Download className="mr-2 size-4" /> {a.href === "/templates" ? "Browse" : "Download"}
                  </a>
                </Button>
              </li>
            ))}
          </ul>

          <div className="mt-8 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Need something custom? Email{" "}
            <Link href="mailto:bknglabs.dev@gmail.com" className="font-medium text-primary underline">
              bknglabs.dev@gmail.com
            </Link>{" "}
            and we'll get back to you within four hours.
          </div>
        </div>
      </section>

    </main>
  )
}
