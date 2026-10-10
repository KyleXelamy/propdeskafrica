import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowUpRight, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { openRoles } from "@/lib/content/site"

export function generateStaticParams() {
  return openRoles.map((r) => ({ id: r.id }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const role = openRoles.find((r) => r.id === id)
  if (!role) return { title: "Role — PropDesk Africa Careers" }
  return { title: `${role.title} — PropDesk Africa Careers`, description: role.excerpt }
}

export default async function RolePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const role = openRoles.find((r) => r.id === id)
  if (!role) notFound()

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="bg-primary text-primary-foreground">
        <div className="container-x pt-40 pb-16 lg:pt-52">
          <Link
            href="/careers"
            className="inline-flex items-center gap-2 text-sm text-primary-foreground/65 hover:text-accent"
          >
            <ArrowLeft className="size-4" /> All open roles
          </Link>
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-accent">
            {role.team} · {role.type}
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-medium leading-[1.05] tracking-[-0.04em] sm:text-6xl">
            {role.title}
          </h1>
          <p className="mt-5 inline-flex items-center gap-2 text-sm text-primary-foreground/65">
            <MapPin className="size-3.5" /> {role.location}
          </p>
        </div>
      </section>

      <article className="container-x max-w-3xl py-16 lg:py-20">
        <p className="text-lg leading-8 text-foreground/85">{role.excerpt}</p>

        <div className="mt-10 space-y-8 text-base leading-8 text-foreground/85">
          <Section title="What you'll do">
            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>Ship meaningful product work weekly — small team, big surface area.</li>
              <li>Pair with design and engineering on ambiguous, high-leverage problems.</li>
              <li>Talk to landlords, tenants and partners. Our roadmap comes from real conversations.</li>
              <li>Help us define and uphold engineering, product or design quality bars.</li>
            </ul>
          </Section>
          <Section title="What we're looking for">
            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>3+ years in your craft (or equivalent real-world experience).</li>
              <li>Strong written communication — we work async across timezones.</li>
              <li>A bias for shipping, learning and being honest about what's not working.</li>
              <li>Comfort with ambiguity. We move fast and the product evolves weekly.</li>
            </ul>
          </Section>
          <Section title="What we offer">
            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>Competitive base + meaningful equity (4-year vest, 1-year cliff).</li>
              <li>Health stipend, home-office stipend, annual learning budget.</li>
              <li>Async-first culture, two short syncs a week, no internal standups.</li>
              <li>Annual in-person off-sites that are actually fun.</li>
            </ul>
          </Section>
        </div>

        <div className="mt-12 rounded-2xl border border-border bg-card p-6 lg:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground">How to apply</p>
          <p className="mt-3 text-base leading-7 text-foreground/85">
            Send your CV, portfolio or GitHub, and a one-paragraph note about why this role. No
            cover letter required. We reply to everyone within 5 business days.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-6 rounded-full bg-primary px-7 text-primary-foreground hover:bg-primary/90"
          >
            <Link
              href={`mailto:bknglabs.dev@gmail.com?subject=${encodeURIComponent(role.title)}`}
            >
              Apply by email <ArrowUpRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      </article>

    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-2xl font-medium tracking-[-0.02em]">{title}</h2>
      {children}
    </section>
  )
}
