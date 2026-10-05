import type { Metadata } from "next"
import Link from "next/link"
import { ArrowUpRight, MapPin, Briefcase, Users, Heart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { openRoles } from "@/lib/content/site"

export const metadata: Metadata = {
  title: "Careers — I-Manage by Siemax Ltd",
  description:
    "Help us build the calm operating system for ambitious landlords. Open roles in engineering, product, design and operations.",
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
              I-Manage is a small team of engineers, designers and former landlords shipping the property
              platform we wished existed. We're hiring across engineering, product and operations.
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
                {openRoles.length} roles open right now.
              </h2>
            </div>
            <p className="hidden text-sm text-muted-foreground sm:block">
              Don't see your role?{" "}
              <Link href="/contact" className="font-medium text-primary underline">
                Send us a note →
              </Link>
            </p>
          </div>

          <ul className="mt-10 divide-y divide-border rounded-2xl border border-border bg-card">
            {openRoles.map((role) => (
              <li key={role.id}>
                <Link
                  href={`/careers/${role.id}`}
                  className="flex flex-col gap-3 p-6 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                >
                  <div className="flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      {role.team} · {role.type}
                    </p>
                    <p className="mt-2 text-lg font-medium leading-tight">{role.title}</p>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{role.excerpt}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="size-3.5" /> {role.location}
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-medium text-primary">
                      Apply <ArrowUpRight className="size-4" />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
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