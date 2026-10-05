import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Acceptable use — I-Manage by Siemax Ltd",
  description: "The rules of the road for using I-Manage.",
}

export default function AcceptableUsePage() {
  return (
    <article className="bg-background py-16 lg:py-20">
      <section className="bg-primary text-primary-foreground">
        <div className="container-x pt-32 pb-12 lg:pt-44">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Legal</p>
          <h1 className="mt-6 text-5xl font-medium leading-[0.98] tracking-[-0.05em] sm:text-7xl">
            Acceptable use policy
          </h1>
          <p className="mt-6 text-sm text-primary-foreground/55">Last updated: 1 October 2026</p>
        </div>
      </section>

      <div className="container-x max-w-3xl py-16">
        <div className="space-y-8 text-base leading-8 text-foreground/85">
          <p>
            These ground rules keep I-Manage working for everyone. By using I-Manage, you agree to
            them. If something on this page confuses you, write to{" "}
            <Link href="mailto:legal@i-manage.app" className="text-primary underline">legal@i-manage.app</Link>.
          </p>

          <Section title="1. You must not use I-Manage to">
            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>Harass, threaten or impersonate tenants, landlords or staff.</li>
              <li>Store or transmit unlawful content in any jurisdiction.</li>
              <li>Attempt to access data belonging to other customers.</li>
              <li>Reverse-engineer, resell, or white-label the service without written permission.</li>
              <li>Bypass rate limits or abuse the API in a way that degrades service for others.</li>
            </ul>
          </Section>

          <Section title="2. Tenant data">
            <p>
              You are responsible for the personal data of your tenants. I-Manage is a processor on
              your behalf — see our{" "}
              <Link href="/legal/dpa" className="text-primary underline">DPA</Link> and{" "}
              <Link href="/legal/privacy" className="text-primary underline">privacy policy</Link>.
            </p>
          </Section>

          <Section title="3. Reporting abuse">
            <p>
              If you suspect another customer is violating these rules, email{" "}
              <Link href="mailto:abuse@i-manage.app" className="text-primary underline">abuse@i-manage.app</Link>.
              We investigate every report.
            </p>
          </Section>

          <Section title="4. Enforcement">
            <p>
              We may suspend or terminate accounts that violate these rules. Where possible, we'll
              warn you first and give you a chance to fix the issue.
            </p>
          </Section>
        </div>
      </div>
    </article>
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