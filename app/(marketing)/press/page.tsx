import type { Metadata } from "next"
import Link from "next/link"
import { ArrowUpRight, Download, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Press — I-Manage by Siemax Ltd",
  description:
    "Press kit, brand assets, coverage and contact for journalists covering I-Manage.",
}

const pressLinks = [
  { outlet: "TechCrunch", title: "I-Manage raises seed to digitise East Africa's rental market", date: "2026-08-12" },
  { outlet: "Disrupt Africa", title: "Siemax Ltd ships M-Pesa-native property OS", date: "2026-05-04" },
  { outlet: "The Standard", title: "Kenyan proptech tackles rent collection head-on", date: "2026-03-21" },
]

const assets = [
  { name: "I-Manage icon (SVG)", size: "Vector", href: "/icon.svg" },
  { name: "I-Manage icon (PNG)", size: "32 KB", href: "/icon-light-32x32.png" },
  { name: "Brand guidelines", size: "Text document", href: "/press/brand-guidelines.txt" },
  { name: "Company fact sheet", size: "Text document", href: "/press/company-fact-sheet.txt" },
  { name: "Landlord templates collection", size: "12 templates", href: "/templates" },
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
                  <Mail className="mr-2 size-4" /> press@i-manage.app
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
            { k: "2,500+", v: "Properties under management" },
            { k: "12", v: "Cities across East Africa" },
            { k: "94.8%", v: "Average on-time collection rate" },
            { k: "Founded 2024", v: "Siemax Ltd, Nairobi" },
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
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Recent coverage</p>
          <h2 className="mt-4 text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-4xl">
            Where we've been featured.
          </h2>
          <ul className="mt-10 divide-y divide-border rounded-2xl border border-border bg-card">
            {pressLinks.map((p) => (
              <li key={p.title} className="flex flex-col gap-2 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {p.outlet} · {new Date(p.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                  <p className="mt-2 text-lg font-medium leading-tight">{p.title}</p>
                </div>
                <ArrowUpRight className="size-5 shrink-0 text-muted-foreground" />
              </li>
            ))}
          </ul>
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
                  <a href={a.href} download={a.href.endsWith(".txt") || a.href.endsWith(".svg") && undefined}>
                    <Download className="mr-2 size-4" /> {a.href === "/templates" ? "Browse" : "Download"}
                  </a>
                </Button>
              </li>
            ))}
          </ul>

          <div className="mt-8 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Need something custom? Email{" "}
            <Link href="mailto:bknglabs.dev@gmail.com" className="font-medium text-primary underline">
              press@i-manage.app
            </Link>{" "}
            and we'll get back to you within four hours.
          </div>
        </div>
      </section>

    </main>
  )
}
