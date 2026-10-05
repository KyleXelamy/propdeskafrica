import type { Metadata } from "next"
import Link from "next/link"
import { ArrowUpRight, MessageCircle, Github, Users, Calendar } from "lucide-react"

export const metadata: Metadata = {
  title: "Community — I-Manage by Siemax Ltd",
  description: "Join the I-Manage community of landlords, developers and property teams.",
}

const channels = [
  {
    icon: MessageCircle,
    name: "Discord",
    description: "4,200+ landlords, agencies and developers. Real-time help, weekly office hours.",
    href: "https://discord.gg/i-manage",
    cta: "Join the Discord",
  },
  {
    icon: Users,
    name: "Forum",
    description: "Long-form discussions, feature debates and product feedback.",
    href: "/community/forum",
    cta: "Visit the forum",
  },
  {
    icon: Github,
    name: "GitHub Discussions",
    description: "Developer topics, API questions and OSS integration examples.",
    href: "https://github.com/Knighty7-ciper/i-manage/discussions",
    cta: "Browse discussions",
  },
  {
    icon: Calendar,
    name: "Office hours",
    description: "Weekly 1-hour video call with the founders. Every Thursday, 4pm EAT.",
    href: "/community/office-hours",
    cta: "Reserve a slot",
  },
]

export default function CommunityPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_50%_30%,#d9f45b,transparent_55%)]" />
        <div className="container-x relative pt-32 pb-20 lg:pt-44 lg:pb-28">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Community</p>
            <h1 className="mt-6 text-5xl font-medium leading-[0.98] tracking-[-0.05em] sm:text-7xl">
              Built with our users, not at them.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-primary-foreground/70">
              4,200+ landlords, agencies and developers hang out with us. We answer everything,
              ship in public, and admit when we screw up.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-background py-16 lg:py-24">
        <div className="container-x">
          <div className="grid gap-5 md:grid-cols-2">
            {channels.map((c) => (
              <Link
                key={c.name}
                href={c.href}
                className="group flex flex-col rounded-3xl border border-border bg-card p-7 transition-shadow hover:shadow-md"
              >
                <span className="grid size-12 place-items-center rounded-2xl bg-secondary text-primary">
                  <c.icon className="size-5" />
                </span>
                <p className="mt-8 text-xl font-medium leading-tight tracking-[-0.02em]">{c.name}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{c.description}</p>
                <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                  {c.cta} <ArrowUpRight className="size-3.5" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-secondary/40 py-20">
        <div className="container-x max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Code of conduct</p>
          <h2 className="mt-3 text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-4xl">
            Be useful. Be kind. Move on.
          </h2>
          <p className="mt-5 text-base leading-7 text-muted-foreground">
            Our community is professional and welcoming. We don't tolerate harassment, we assume good
            intent, and we close threads that go in circles. Full{" "}
            <Link href="/community/code-of-conduct" className="font-medium text-primary underline">
              code of conduct →
            </Link>
          </p>
        </div>
      </section>
    </>
  )
}