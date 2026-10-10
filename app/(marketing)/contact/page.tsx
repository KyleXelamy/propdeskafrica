import type { Metadata } from "next"
import Link from "next/link"
import { ArrowUpRight, Mail, MessageSquare, MapPin, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ContactForm } from "@/components/contact-form"
import { BRAND } from "@/lib/brand"

export const metadata: Metadata = {
  title: "Contact — PropDesk Africa by Siemax Ltd",
  description:
    "Get in touch with the PropDesk Africa team. We respond to every message within one business day.",
}

const channels = [
  {
    icon: Mail,
    label: "General",
    value: BRAND.supportEmail,
    href: `mailto:${BRAND.supportEmail}`,
    note: "For sales questions, partnerships and feedback.",
  },
  {
    icon: MessageSquare,
    label: "Support",
    value: BRAND.supportEmail,
    href: `mailto:${BRAND.supportEmail}`,
    note: "For existing customers — Pro & Agency get priority.",
  },
  {
    icon: Phone,
    label: "Phone",
    value: BRAND.supportPhone,
    href: BRAND.supportPhoneHref,
    note: "Mon–Fri, 9am–5pm EAT. For urgent issues only.",
  },
  {
    icon: MapPin,
    label: "Office",
    value: "Westlands, Nairobi",
    href: null,
    note: "Visits by appointment only.",
  },
]

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_20%_80%,#d9f45b,transparent_55%)]" />
        <div className="container-x relative pt-40 pb-20 lg:pt-56 lg:pb-28">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Contact</p>
            <h1 className="mt-6 text-5xl font-medium leading-[0.98] tracking-[-0.05em] sm:text-7xl">
              Real humans. <em className="font-serif font-normal text-accent">Real answers.</em>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-primary-foreground/70">
              Tell us what you're working on. We read every message and reply within one business day —
              usually faster.
            </p>
          </div>
        </div>
      </section>

      {/* Grid */}
      <section className="bg-background py-20 lg:py-24">
        <div className="container-x grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:gap-20">
          {/* Channels */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Other ways to reach us</p>
            <h2 className="mt-5 text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-4xl">
              Pick whichever feels easiest.
            </h2>
            <ul className="mt-10 space-y-6">
              {channels.map((c) => (
                <li key={c.label} className="rounded-2xl border border-border bg-card p-6">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-full bg-secondary text-primary">
                      <c.icon className="size-4" />
                    </span>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{c.label}</p>
                  </div>
                  {c.href ? (
                    <Link
                      href={c.href}
                      className="mt-4 block text-lg font-medium text-foreground hover:text-primary"
                    >
                      {c.value}
                    </Link>
                  ) : (
                    <p className="mt-4 text-lg font-medium">{c.value}</p>
                  )}
                  <p className="mt-2 text-sm text-muted-foreground">{c.note}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* Form */}
          <div>
            <div className="rounded-3xl border border-border bg-card p-8 lg:p-10">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Send a message</p>
              <h2 className="mt-4 text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-4xl">
                What can we help with?
              </h2>
              <ContactForm />
            </div>
            <p className="mt-6 text-xs text-muted-foreground">
              By submitting, you agree to our{" "}
              <Link href="/legal/privacy" className="underline">privacy policy</Link>.
              We never share your details with third parties.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-accent text-accent-foreground py-20">
        <div className="container-x text-center">
          <h2 className="mx-auto max-w-2xl text-4xl font-medium leading-tight tracking-[-0.04em] sm:text-5xl">
            Not sure yet? Just try it.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base leading-7 text-accent-foreground/80">
            The first 3 units are free. No credit card. No phone calls. No "free trial expiring soon."
          </p>
          <Button
            asChild
            size="lg"
            className="mt-8 rounded-full bg-primary px-7 text-primary-foreground hover:bg-primary/90"
          >
            <Link href="/auth/sign-up">Start free <ArrowUpRight data-icon="inline-end" /></Link>
          </Button>
        </div>
      </section>

    </main>
  )
}
