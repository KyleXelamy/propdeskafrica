import type { Metadata } from "next"
import Link from "next/link"
import { ArrowUpRight, MessageSquare, ThumbsUp, Sparkles, Wrench, BarChart3, Building2, CreditCard } from "lucide-react"
import { roadmap, type RoadmapStatus } from "@/lib/content/marketing"

export const metadata: Metadata = {
  title: "Roadmap — PropDesk Africa by Siemax Ltd",
  description: "What we're building next at PropDesk Africa, in public.",
}

const order: RoadmapStatus[] = ["Now", "Next", "Later", "Shipped"]
const statusStyles: Record<RoadmapStatus, string> = {
  Now: "bg-accent text-accent-foreground",
  Next: "bg-primary text-primary-foreground",
  Later: "bg-secondary text-secondary-foreground",
  Shipped: "bg-success/15 text-success",
}

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  Core: Sparkles,
  Payments: CreditCard,
  Tenant: MessageSquare,
  Reporting: BarChart3,
  Platform: Wrench,
}

export default function RoadmapPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_50%_30%,#d9f45b,transparent_55%)]" />
        <div className="container-x relative pt-32 pb-16 lg:pt-44">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Roadmap</p>
          <h1 className="mt-6 text-5xl font-medium leading-[0.98] tracking-[-0.05em] sm:text-7xl">
            What we're building. In public.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-primary-foreground/70">
            Vote on what's next, see what's already shipped, and tell us what we should be working on.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/customer-requests"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-primary hover:bg-accent/90"
            >
              <MessageSquare className="size-4" /> Request a feature
            </Link>
            <Link
              href="/changelog"
              className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/30 px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-foreground/10"
            >
              See what's shipped <ArrowUpRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-background py-16 lg:py-20">
        <div className="container-x">
          {order.map((status) => {
            const items = roadmap.filter((r) => r.status === status)
            if (items.length === 0) return null
            return (
              <div key={status} className="mb-12 last:mb-0">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[status]}`}>
                    {status}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {items.length} item{items.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                  {items.map((item) => {
                    const Icon = categoryIcons[item.category] ?? Building2
                    return (
                      <article key={item.slug} className="flex flex-col rounded-2xl border border-border bg-card p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
                              <Icon className="size-4" />
                            </span>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                {item.category}
                              </p>
                              <p className="mt-1 text-base font-medium leading-tight">{item.title}</p>
                            </div>
                          </div>
                          {item.votes > 0 && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                              <ThumbsUp className="size-3" /> {item.votes}
                            </span>
                          )}
                        </div>
                        <p className="mt-4 text-sm leading-6 text-muted-foreground">{item.description}</p>
                      </article>
                    )
                  })}
                </div>
              </div>
            )
          })}

          <div className="mt-12 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Don't see your feature? <Link href="/customer-requests" className="font-medium text-primary underline">Request it →</Link>
          </div>
        </div>
      </section>
    </>
  )
}