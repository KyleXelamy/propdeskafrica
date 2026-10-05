import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, ArrowUpRight } from "lucide-react"
import { solutions } from "@/lib/content/marketing"

export const metadata: Metadata = {
  title: "Solutions — I-Manage by Siemax Ltd",
  description:
    "I-Manage for solo landlords, commercial operators, agencies, vacation rentals, developers and enterprise teams.",
}

export default function SolutionsHub() {
  return (
    <>
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_50%_30%,#d9f45b,transparent_55%)]" />
        <div className="container-x relative pt-32 pb-20 lg:pt-44 lg:pb-28">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Solutions</p>
            <h1 className="mt-6 text-5xl font-medium leading-[0.98] tracking-[-0.05em] sm:text-7xl">
              Built for the way you actually work.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-primary-foreground/70">
              Whether you're running one unit or a thousand, I-Manage adapts to your workflow instead
              of forcing you into ours.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-background py-16 lg:py-24">
        <div className="container-x">
          <div className="grid gap-6 md:grid-cols-2">
            {solutions.map((s) => (
              <Link
                key={s.slug}
                href={`/solutions/${s.slug}`}
                className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-card transition-shadow hover:shadow-lg"
              >
                <div className="aspect-[16/8] overflow-hidden bg-muted">
                  <img src={s.image} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                </div>
                <div className="flex flex-1 flex-col p-7">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{s.audience}</p>
                  <h2 className="mt-3 text-2xl font-medium leading-tight tracking-[-0.03em] sm:text-3xl">{s.name}</h2>
                  <p className="mt-2 text-base font-medium text-primary">{s.tagline}</p>
                  <p className="mt-4 flex-1 text-sm leading-7 text-muted-foreground">{s.summary}</p>
                  <div className="mt-6 flex items-center gap-5 border-t border-border pt-5">
                    {s.outcomes.slice(0, 2).map((o) => (
                      <div key={o.label}>
                        <p className="text-lg font-medium">{o.value}</p>
                        <p className="text-xs text-muted-foreground">{o.label}</p>
                      </div>
                    ))}
                  </div>
                  <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary">
                    Read the playbook <ArrowUpRight className="size-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-accent text-accent-foreground py-20">
        <div className="container-x text-center">
          <h2 className="mx-auto max-w-2xl text-4xl font-medium leading-tight tracking-[-0.04em] sm:text-5xl">
            Not sure where you fit?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base leading-7 text-accent-foreground/80">
            Book a 20-minute call and we'll recommend the right plan + setup.
          </p>
          <Link
            href="/contact/sales"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Talk to sales <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    </>
  )
}