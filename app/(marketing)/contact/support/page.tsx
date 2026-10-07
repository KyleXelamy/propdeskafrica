import type { Metadata } from "next"
import Link from "next/link"
import { ArrowUpRight, Mail, MessageSquare, BookOpen, FileText } from "lucide-react"
import { ContactForm } from "@/components/contact-form"

export const metadata: Metadata = {
  title: "Support — I-Manage by Siemax Ltd",
  description: "Get help with I-Manage. Documentation, community and direct support.",
}

export default function ContactSupportPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_70%_30%,#d9f45b,transparent_55%)]" />
        <div className="container-x relative pt-32 pb-16 lg:pt-44">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Support</p>
          <h1 className="mt-6 max-w-3xl text-5xl font-medium leading-[0.98] tracking-[-0.05em] sm:text-7xl">
            We&apos;ve got you.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-primary-foreground/70">
            Self-serve docs, an in-app ticket system, or a real human — whichever you prefer.
          </p>
        </div>
      </section>

      <section className="bg-background py-16 lg:py-20">
        <div className="container-x">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { icon: BookOpen, title: "Docs first", body: "Most questions are already answered in the docs.", href: "/docs", cta: "Browse docs" },
              { icon: MessageSquare, title: "Community", body: "4,200+ landlords in our Discord. Open 24/7.", href: "/community", cta: "Join the Discord" },
              { icon: Mail, title: "Email us", body: "We reply within one business day, usually faster.", href: "mailto:bknglabs.dev@gmail.com", cta: "bknglabs.dev@gmail.com" },
            ].map((c) => (
              <Link
                key={c.title}
                href={c.href}
                className="group flex flex-col rounded-3xl border border-border bg-card p-6 transition-shadow hover:shadow-md"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-secondary text-primary">
                  <c.icon className="size-5" />
                </span>
                <p className="mt-8 text-lg font-medium leading-tight">{c.title}</p>
                <p className="mt-2 text-sm text-muted-foreground">{c.body}</p>
                <span className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  {c.cta} <ArrowUpRight className="size-3.5" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-secondary/40 py-16 lg:py-20">
        <div className="container-x grid gap-12 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Open a ticket</p>
            <h2 className="mt-3 text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-4xl">
              Send us a detailed report.
            </h2>
            <p className="mt-5 text-base leading-7 text-muted-foreground">
              We&apos;ll reply within one business day. For Pro and Agency plans, priority response
              is under 4 hours during EAT business hours.
            </p>
            <p className="mt-8 text-sm text-muted-foreground">
              <FileText className="mr-1 inline size-3.5" />
              Prefer to read first? Check the{" "}
              <Link href="/help" className="text-primary underline">help center</Link>.
            </p>
          </div>
          <div className="rounded-3xl border border-border bg-card p-7 lg:p-10">
            <ContactForm />
          </div>
        </div>
      </section>
    </>
  )
}
