import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowUpRight, Calendar, Clock } from "lucide-react"
import { insights } from "@/lib/content/marketing"

export function generateStaticParams() {
  return insights.map((i) => ({ slug: i.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const i = insights.find((x) => x.slug === slug)
  if (!i) return { title: "Insight — I-Manage" }
  return { title: `${i.title} — I-Manage Insights`, description: i.excerpt, openGraph: { images: [i.cover] } }
}

const insightBodies: Record<string, string> = {
  "future-of-rent-collection-africa": `For most of the last decade, "rent collection in Africa" was a euphemism for a knock on the door, a phone call, or — if you were lucky — an M-Pesa transaction you chased the tenant to confirm.

That's finally changing. The combination of universal mobile money penetration, API-first payment infrastructure (Safaricom Daraja, Airtel Money, M-Pesa Africa) and a generation of landlords who grew up with smartphones has created the conditions for a different kind of property software.

## What US-built rent platforms get wrong

The dominant US property platforms — Buildium, AppFolio, Yardi — were designed for cheque payments, US banking rails, and a regulatory environment that's very different from East Africa. The fundamental architecture of "tenant pays into our account, we ACH it to the landlord three days later" simply doesn't work when the tenant is paying with a mobile money balance.

We spent two years studying where these tools failed in our market:

- They assume a credit score. Half of our tenants don't have one.
- They assume an email address. Many of ours don't check it.
- They assume desktop-first. 80% of property managers in Nairobi run their business from a phone.

## What we built differently

I-Manage is designed around three constraints specific to our market:

1. **STK Push is the default**, not a bolt-on. The dashboard, the tenant records and the API all assume a mobile money collection flow.
2. **Reconciliation is a first-class feature.** Daraja's callback isn't always reliable. We reconcile every night against the transaction log.
3. **WhatsApp is a tier-1 channel**, not an afterthought. Every notification has a WhatsApp variant.

The result is a product that works in Mombasa, Lagos and Kampala — not just Mountain View.`,
  "landlord-economics-2026": `African residential yields in 2026 are not what they were in 2016. The forces compressing them are real: rising interest rates, new construction supply in the mid-market segment, and a generation of tenants who can move more easily than ever.

This piece walks through the numbers, what they mean for landlords, and where the smart money is focusing.

## The headline numbers

Average gross yield in Nairobi's mid-market segment has compressed from 7.2% in 2016 to 5.1% in 2026. The drivers: interest rates up ~400bps, new supply up ~60% in satellite suburbs, and operating costs up ~30% in real terms.

## What "smart" looks like now

The landlords doing best in 2026 share three habits:

- **They operate more units, not better units.** Operating leverage on overheads matters more than per-unit yield.
- **They charge for extras.** Parking, water, generator usage — these are now line items, not bundled into rent.
- **They collect faster.** A 5% yield improvement on the same rent is achievable just by tightening collection.

That's where I-Manage earns its keep — not by increasing rents, but by helping landlords collect every shilling they're owed, on time, with less manual work.`,
  "why-we-built-our-own-reconciliation": `The single most expensive line item in our monthly burn is not engineers, marketing or office rent. It's "mismatched payment records."

When STK Push goes wrong — and it does, roughly 1.4% of the time — the prompt never arrives, the customer cancels, or the callback never reaches us. The tenant's money may or may not have moved. The landlord's ledger is now wrong.

## What we tried first

Our first attempt at reconciliation was a daily cron job that pulled Daraja's transaction log and matched it against our internal ledger. It worked, but only at night — by the time a mismatch was detected, the landlord had already called the tenant to chase "missing" rent.

## What we built

We built our own reconciliation engine that runs continuously, not nightly. It:

- Pulls Daraja's transaction log every 60 seconds
- Matches against our internal payment records
- Flags mismatches in a real-time inbox inside the dashboard
- Auto-emails both parties a confirmation when it resolves

Clear workflows can help teams resolve issues with less back-and-forth and keep better records.`,
}

export default async function InsightArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const insight = insights.find((i) => i.slug === slug)
  if (!insight) notFound()
  const body = insightBodies[slug] ?? "Full essay coming soon."

  return (
    <article className="bg-background">
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="container-x pt-32 pb-12 lg:pt-44">
          <Link href="/insights" className="inline-flex items-center gap-2 text-sm text-primary-foreground/65 hover:text-accent">
            <ArrowLeft className="size-4" /> Back to insights
          </Link>
          <p className="mt-8 inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-accent">
            <Calendar className="size-3.5" />
            {new Date(insight.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            <span aria-hidden>·</span>
            <Clock className="size-3.5" /> {insight.readingMinutes} min read
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-medium leading-[1.05] tracking-[-0.04em] sm:text-6xl">
            {insight.title}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-7 text-primary-foreground/75">{insight.excerpt}</p>
          <div className="mt-8 flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-accent text-sm font-medium text-primary">
              {insight.author.split(" ").map((p) => p[0]).join("").slice(0, 2)}
            </span>
            <p className="text-sm text-primary-foreground/75">By {insight.author}</p>
          </div>
        </div>
      </section>

      <div className="container-x -mt-1">
        <div className="aspect-[16/7] overflow-hidden rounded-3xl border border-border bg-muted">
          <img src={insight.cover} alt="" className="h-full w-full object-cover" />
        </div>
      </div>

      <article className="container-x max-w-3xl py-16 lg:py-20">
        {body.split(/\n{2,}/g).map((block, i) => {
          if (block.startsWith("## ")) {
            return (
              <h2 key={i} className="mt-10 text-2xl font-medium tracking-[-0.02em]">
                {block.replace(/^## /, "")}
              </h2>
            )
          }
          if (block.startsWith("- ")) {
            const items = block.split(/\n/).map((l) => l.replace(/^- /, ""))
            return (
              <ul key={i} className="mt-6 space-y-3">
                {items.map((it, j) => (
                  <li key={j} className="flex gap-3">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            )
          }
          return (
            <p key={i} className="mt-5 text-base leading-8 text-foreground/85 sm:text-lg">
              {block}
            </p>
          )
        })}

        <div className="mt-16 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Want this in your inbox?{" "}
          <Link href="/resources" className="font-medium text-primary underline">Subscribe to our monthly essay →</Link>
        </div>
      </article>
    </article>
  )
}
