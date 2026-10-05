import type { Metadata } from "next"
import Link from "next/link"
import { ArrowUpRight, Briefcase, Users, Heart, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Careers — I-Manage by Siemax Ltd",
  description:
    "Learn how I-Manage works and stay in touch for future opportunities. No roles are currently open.",
}

const benefits = [
  {
    icon: Heart,
    title: "Real ownership",
    body: "Equity for every full-time role, vesting on a 4-year schedule with a 1-year cliff. We mean it.",
  },
  {
    icon: Users,
    title: "Work alongside landlords",
    body: "Every quarter we ship alongside a real landlord partner. You will use the product in anger with the people who pay for it.",
  },
  {
    icon: Briefcase,
    title: "Async by default",
    body: "No internal standups. Deep work time protected. Two short syncs a week, and that's it.",
  },
  {
    icon: MapPin,
    title: "Remote across Africa",
    body: "Offices in Nairobi with a home-office stipend. Annual in-person off-sites that are actually fun.",
  },
]

export default function CareersPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_20%_30%,#d9f45b,transparent_55%)]" />
        <div className="container-x relative pt-40 pb-20 lg:pt-56 lg:pb-28">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Careers</p>
            <h1 className="mt-6 text-5xl font-medium leading-[0.98] tracking-[-0.05em] sm:text-7xl">
              Build software landlords <em className="font-serif font-normal text-accent">actually love.</em>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-primary-foreground/70">
              I-Manage is a small team at Siemax Ltd building the property platform we wished existed.
              There are no open roles right now, but this page will be updated when that changes.
            </p>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-background py-20 lg:py-24">
        <div className="container-x">
          <div className="grid gap-12 lg:grid-cols-[.85fr_1.15fr] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">How we work</p>
              <h2 className="mt-5 text-4xl font-medium leading-tight tracking-[-0.04em] sm:text-5xl">
                Adults, treated like adults.
              </h2>
            </div>
            <p className="max-w-md text-base leading-7 text-muted-foreground">
              We hire people who do the right thing without being asked. Then we get out of their way.
            </p>
          </div>
          <div className="mt-16 grid gap-px overflow-hidden rounded-3xl bg-border md:grid-cols-2">
            {benefits.map(({ icon: Icon, title, body }) => (
              <article key={title} className="bg-card p-8 lg:p-10">
                <Icon className="size-8 text-primary" strokeWidth={1.5} />
                <h3 className="mt-12 text-xl font-medium leading-tight tracking-[-0.03em]">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Open roles */}
      <section className="bg-secondary/40 py-20 lg:py-24">
        <div className="container-x">
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Open roles</p>
              <h2 className="mt-4 text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-4xl">
                No roles open right now.
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground sm:text-right">
              We are not hiring at the moment, but we keep this page updated when that changes.
            </p>
          </div>

          <div className="mt-10 rounded-2xl border border-border bg-card p-8 sm:p-10">
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              I-Manage is built by Siemax Ltd. If you have a future opportunity in mind, send a brief note and we will keep it on file for the right opening.
            </p>
            <Button asChild className="mt-6 rounded-full">
              <Link href="/contact">Contact the team <ArrowUpRight data-icon="inline-end" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-accent text-accent-foreground py-20">
        <div className="container-x text-center">
          <h2 className="mx-auto max-w-2xl text-4xl font-medium leading-tight tracking-[-0.04em] sm:text-5xl">
            Don't see your role? We still want to hear from you.
          </h2>
          <Button
            asChild
            size="lg"
            className="mt-8 rounded-full bg-primary px-7 text-primary-foreground hover:bg-primary/90"
          >
            <Link href="/contact">Send a note <ArrowUpRight data-icon="inline-end" /></Link>
          </Button>
        </div>
      </section>

    </main>
  )
}
