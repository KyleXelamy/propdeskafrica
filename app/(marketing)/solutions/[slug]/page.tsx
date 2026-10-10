import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowUpRight, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { solutions } from "@/lib/content/marketing"

export function generateStaticParams() {
  return solutions.map((s) => ({ slug: s.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const s = solutions.find((x) => x.slug === slug)
  if (!s) return { title: "Solution — PropDesk Africa" }
  return { title: `${s.name} — PropDesk Africa`, description: s.summary }
}

export default async function SolutionPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const s = solutions.find((x) => x.slug === slug)
  if (!s) notFound()

  return (
    <>
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_50%_30%,#d9f45b,transparent_55%)]" />
        <div className="container-x relative pt-32 pb-12 lg:pt-44">
          <Link
            href="/solutions"
            className="inline-flex items-center gap-2 text-sm text-primary-foreground/65 hover:text-accent"
          >
            <ArrowLeft className="size-4" /> All solutions
          </Link>
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-accent">{s.audience}</p>
          <h1 className="mt-4 max-w-3xl text-5xl font-medium leading-[1.05] tracking-[-0.04em] sm:text-7xl">
            {s.name}
          </h1>
          <p className="mt-5 max-w-2xl text-xl text-primary-foreground/80">{s.tagline}</p>
          <p className="mt-6 max-w-2xl text-base leading-7 text-primary-foreground/65">{s.summary}</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="rounded-full bg-accent px-7 text-primary hover:bg-accent/90">
              <Link href="/auth/sign-up">Start free <ArrowUpRight data-icon="inline-end" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full border-primary-foreground/30 bg-transparent px-7 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
              <Link href="/contact/sales">Book a 20-min call</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="container-x -mt-1">
        <div className="aspect-[16/7] overflow-hidden rounded-3xl border border-border bg-muted">
          <img src={s.image} alt="" className="h-full w-full object-cover" />
        </div>
      </section>

      <section className="bg-secondary/40 py-20 lg:py-24">
        <div className="container-x max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Why teams switch</p>
          <h2 className="mt-4 text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-4xl">
            Common reasons teams choose PropDesk Africa.
          </h2>
          <ul className="mt-10 space-y-4">
            {[
              `Native M-Pesa, Airtel Money and Tigo Pesa out of the box — no Zapier glue.`,
              `Tenant records that actually stay up to date — auto-synced with every payment.`,
              `Reports your accountant will sign off on, with audit log for every change.`,
              `Pricing that doesn't punish you for growing — flat monthly, no per-transaction fee.`,
              `Real humans on support — contact us when you need help.`,
            ].map((b) => (
              <li key={b} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3" />
                </span>
                <span className="text-base leading-6">{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  )
}
