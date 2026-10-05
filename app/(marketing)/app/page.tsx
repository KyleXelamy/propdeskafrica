import type { Metadata } from "next"
import Link from "next/link"
import { ArrowUpRight, Smartphone, Bell, Wifi, Download, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "I-Manage App — Run your portfolio from your pocket",
  description:
    "Install I-Manage as a Progressive Web App on iOS or Android. Native feel, no app store friction.",
}

const features = [
  {
    icon: Smartphone,
    title: "Install in 30 seconds",
    body: "No app store round-trip. Add to Home Screen and you're done — same speed as a native app.",
  },
  {
    icon: Bell,
    title: "Push when it matters",
    body: "Get notified for rent received, maintenance updates, lease expiries and document reviews.",
  },
  {
    icon: Wifi,
    title: "Works on flaky networks",
    body: "Built for the realities of mobile data in East Africa. Queue actions offline, sync when you reconnect.",
  },
  {
    icon: Share2,
    title: "Share with tenants",
    body: "Send tenants a magic invite so they can pay rent, view their lease, and raise maintenance from their own phone.",
  },
]

const steps = [
  {
    n: "01",
    title: "Open in your browser",
    body: "Visit i-manage.app on iOS Safari or Android Chrome and sign in.",
  },
  {
    n: "02",
    title: "Add to Home Screen",
    body: "Tap the share icon, then 'Add to Home Screen'. We'll handle the rest.",
  },
  {
    n: "03",
    title: "Run your portfolio",
    body: "Open the I-Manage app from your launcher. It launches fullscreen, just like a native app.",
  },
]

export default function AppLandingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(21,35,29,.98)_12%,rgba(21,35,29,.6)_82%,transparent),url('https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=2200&q=80')] bg-cover bg-center" />
        <div className="container-x relative grid min-h-[680px] grid-cols-1 items-end gap-12 pt-40 pb-20 lg:grid-cols-[1.1fr_1fr] lg:pt-56 lg:pb-28">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Landlord app</p>
            <h1 className="mt-6 max-w-2xl text-5xl font-medium leading-[0.98] tracking-[-0.05em] sm:text-7xl">
              Your portfolio, in your pocket.
            </h1>
            <p className="mt-7 max-w-lg text-lg leading-8 text-primary-foreground/70">
              I-Manage ships as a Progressive Web App. Install it once, use it anywhere — even when
              the network isn't cooperating.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="rounded-full bg-accent px-7 text-primary hover:bg-accent/90">
                <Link href="/auth/sign-up">
                  <Download className="mr-2 size-4" /> Try the app
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full border-primary-foreground/30 bg-transparent px-7 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                <Link href="/pricing">See pricing <ArrowUpRight data-icon="inline-end" /></Link>
              </Button>
            </div>
          </div>

          {/* Phone preview */}
          <div className="mx-auto w-full max-w-sm lg:justify-self-end">
            <div className="relative aspect-[9/19] rounded-[2.5rem] border border-primary-foreground/20 bg-primary-foreground/5 p-3 shadow-2xl backdrop-blur">
              <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-b-2xl bg-primary" />
              <div className="h-full w-full overflow-hidden rounded-[1.8rem] bg-background">
                <div className="border-b border-border bg-card p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Good morning, Brian</p>
                  <p className="mt-1 text-xl font-semibold">Today</p>
                </div>
                <div className="space-y-3 p-4">
                  {[
                    { k: "Rent collected", v: "KES 184,500", c: "text-success" },
                    { k: "Pending payments", v: "2 tenants", c: "text-warning" },
                    { k: "Open maintenance", v: "1 urgent", c: "text-destructive" },
                    { k: "Leases expiring", v: "in 14 days", c: "text-muted-foreground" },
                  ].map((s) => (
                    <div key={s.k} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
                      <div>
                        <p className="text-xs text-muted-foreground">{s.k}</p>
                        <p className={`mt-1 text-lg font-medium ${s.c}`}>{s.v}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-background py-24 lg:py-32">
        <div className="container-x">
          <div className="grid gap-12 lg:grid-cols-[.85fr_1.15fr] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Built for mobile</p>
              <h2 className="mt-5 max-w-xl text-4xl font-medium leading-tight tracking-[-0.04em] sm:text-6xl">
                Feels like a native app. Installs like a website.
              </h2>
            </div>
            <p className="max-w-md text-base leading-7 text-muted-foreground">
              Most property software treats mobile as an afterthought. We started from a phone — and it
              shows. The landlord app is the primary way most of our users run their portfolio day-to-day.
            </p>
          </div>
          <div className="mt-20 grid gap-px overflow-hidden rounded-3xl bg-border md:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, body }) => (
              <article key={title} className="bg-card p-8">
                <Icon className="size-7 text-primary" strokeWidth={1.5} />
                <h3 className="mt-10 text-xl font-medium leading-tight tracking-[-0.03em]">{title}</h3>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="bg-secondary/40 py-24 lg:py-32">
        <div className="container-x">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Install in three steps</p>
          <h2 className="mt-5 max-w-2xl text-4xl font-medium leading-tight tracking-[-0.04em] sm:text-6xl">
            No app store. No 50 MB download.
          </h2>
          <ol className="mt-16 grid gap-6 lg:grid-cols-3">
            {steps.map((s) => (
              <li key={s.n} className="rounded-3xl bg-card p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-foreground/80">
                  Step {s.n}
                </p>
                <h3 className="mt-6 text-2xl font-medium leading-tight tracking-[-0.03em]">{s.title}</h3>
                <p className="mt-4 text-base leading-7 text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-accent text-accent-foreground py-20">
        <div className="container-x text-center">
          <h2 className="mx-auto max-w-2xl text-4xl font-medium leading-tight tracking-[-0.04em] sm:text-5xl">
            Skip the download. Just install it.
          </h2>
          <Button
            asChild
            size="lg"
            className="mt-8 rounded-full bg-primary px-7 text-primary-foreground hover:bg-primary/90"
          >
            <Link href="/auth/sign-up">Get the app <ArrowUpRight data-icon="inline-end" /></Link>
          </Button>
        </div>
      </section>

    </main>
  )
}