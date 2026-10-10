/**
 * PropDesk Africa blog / resources content. Static until we wire up a CMS later.
 * Each post has enough metadata to render both the index and detail pages
 * and to satisfy /api/blog and /api/blog/[slug].
 */

export type Author = {
  name: string
  role: string
  initials: string
}

export type BlogPost = {
  slug: string
  title: string
  excerpt: string
  category: "Product" | "Operations" | "Finance" | "Compliance" | "Field notes"
  publishedAt: string // ISO date
  readingMinutes: number
  author: Author
  cover: string
  body: string // simple markdown-lite (paragraphs + h2 + lists)
  tags: string[]
}

export const authors: Record<string, Author> = {
  brian: { name: "Brian Kiarie", role: "Founder, CFO & Operations", initials: "BK" },
  wanjiku: { name: "Wanjiku Mwangi", role: "Head of Product", initials: "WM" },
  team: { name: "The PropDesk Africa team", role: "Property operations", initials: "IM" },
}

export const blogPosts: BlogPost[] = [
  {
    slug: "automating-mpesa-rent-collection",
    title: "How we automated M-Pesa rent collection (without the headache)",
    excerpt:
      "STK Push is amazing when it works — and miserable when it doesn't. Here's how PropDesk Africa handles retries, timeouts and reconciliation.",
    category: "Product",
    publishedAt: "2026-09-18",
    readingMinutes: 6,
    author: authors.brian,
    cover:
      "https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?auto=format&fit=crop&w=1600&q=80",
    tags: ["mpesa", "daraja", "payments"],
    body: `Most landlords we talked to before launching PropDesk Africa had the same story. They would initiate an M-Pesa STK Push, the tenant would get the prompt, enter their PIN… and then the request would either succeed and not reflect anywhere, or quietly fail.

In this post we walk through how PropDesk Africa talks to Safaricom's Daraja API and the small details that make the difference between a 99% collection rate and a 60% one.

## The three failure modes we obsessed over

When STK Push goes wrong it usually goes wrong in one of three ways:

- The customer's phone is offline and never receives the prompt.
- The prompt arrives but the customer cancels.
- The customer succeeds but the callback never reaches our server.

We treat each differently.

## Retries that respect the customer

We never auto-retry without consent. If the prompt never arrived, we let the landlord trigger a fresh STK Push from the dashboard. If the customer cancelled, we add a one-line note ("Joseph cancelled at 14:02") so the landlord can follow up with context.

## Reconciliation as a first-class feature

Every night we run a reconciliation pass that compares Daraja's transaction log against our internal ledger. Discrepancies show up in a single inbox — never as silent drift.

If you want to dig into the code, the lib/mpesa folder is open and the routes under /api/mpesa/* are short enough to read in one sitting.`,
  },
  {
    slug: "first-30-days-as-a-landlord",
    title: "The first 30 days as a new landlord: a no-drama checklist",
    excerpt:
      "Buying your first rental property is exciting. The next 30 days are paperwork. Here's the shortest path through it.",
    category: "Field notes",
    publishedAt: "2026-09-04",
    readingMinutes: 8,
    author: authors.wanjiku,
    cover:
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80",
    tags: ["checklist", "landlords", "operations"],
    body: `If you've just closed on your first rental unit — congrats. The next month is where most new landlords quietly lose money. Here's the order of operations we recommend.

## Week 1 — Get the basics in place

- Register the unit in your property management tool (that's us, if you want it to be).
- Photograph every wall, every fixture, every appliance. Date-stamped photos settle 90% of move-out disputes.
- Decide on a tenancy agreement template and store it centrally.

## Week 2 — Find and screen tenants

Skip the "first to bring cash" mental ads. Use a structured application form and check references — even if it's a friend's cousin. Treat this as a 5-year relationship, not a one-month transaction.

## Week 3 — Sign the lease and collect the deposit

A lease isn't real until it's signed, witnessed, and the deposit has cleared. Use a deposit that matches at least one full month of rent and document its receipt separately from monthly rent.

## Week 4 — Set up recurring workflows

This is where most landlords fall apart. The lease got signed and then nothing happens. Before you know it, six months have passed and you don't know which tenants are late.

Set up three reminders today: rent due, lease expiring, and maintenance follow-up. If your software doesn't do that, it's the wrong software.

## Closing thought

The best landlords we work with spend their first 30 days building systems, not chasing tenants. The rent will come — your job is to make the rest of it boring.`,
  },
  {
    slug: "what-94-percent-collection-rate-actually-means",
    title: "What a 94% rent collection rate actually means",
    excerpt:
      "Marketing copy loves a high collection percentage. Here's what's hiding inside it — and how to read the number honestly.",
    category: "Finance",
    publishedAt: "2026-08-22",
    readingMinutes: 5,
    author: authors.team,
    cover:
      "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1600&q=80",
    tags: ["finance", "reporting", "metrics"],
    body: `You'll see property platforms advertise collection rates of 94%, 97%, even 99%. The number is usually real. The way it's calculated usually isn't.

## Three definitions of "collected"

A platform can call rent "collected" when:

1. The tenant clicked pay. (Weak — many clicks never settle.)
2. The money is in your M-Pesa till. (Better, but doesn't account for reversals.)
3. The money has been in your account for more than 30 days with no clawback. (Best.)

We use definition three. It's why our headline number is 94.8% rather than something prettier.

## Time-weighted vs dollar-weighted

If you have one KES 200,000 unit and one KES 15,000 unit, an on-time payment from the cheap unit looks the same as one from the expensive one if you count transactions. We weight by expected rent so the number reflects actual cashflow, not vibes.

## What to ask any platform

When someone quotes you a collection rate, ask two questions:

- What's the window — last 30 days, last 12 months, trailing lifetime?
- Is it transaction-weighted or amount-weighted?

If they can't answer both in plain English, the number probably isn't worth much.`,
  },
]

export function getBlogPost(slug: string) {
  return blogPosts.find((p) => p.slug === slug)
}

export function getRelatedPosts(slug: string, limit = 2): BlogPost[] {
  const target = getBlogPost(slug)
  if (!target) return []
  return blogPosts
    .filter((p) => p.slug !== slug)
    .sort((a, b) => {
      const aScore = a.tags.filter((t) => target.tags.includes(t)).length
      const bScore = b.tags.filter((t) => target.tags.includes(t)).length
      return bScore - aScore
    })
    .slice(0, limit)
}
