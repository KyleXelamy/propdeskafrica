import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Cookie policy — I-Manage by Siemax Ltd",
  description: "What cookies we use, why, and how to opt out.",
}

export default function CookiePolicyPage() {
  return (
    <article className="bg-background py-16 lg:py-20">
      <section className="bg-primary text-primary-foreground">
        <div className="container-x pt-32 pb-12 lg:pt-44">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Legal</p>
          <h1 className="mt-6 text-5xl font-medium leading-[0.98] tracking-[-0.05em] sm:text-7xl">
            Cookie policy
          </h1>
          <p className="mt-6 text-sm text-primary-foreground/55">Last updated: 1 October 2026</p>
        </div>
      </section>

      <div className="container-x max-w-3xl py-16">
        <div className="space-y-8 text-base leading-8 text-foreground/85">
          <p>
            This policy explains what cookies I-Manage sets, what they do, and how you can opt out.
            We try to use as few as possible — and we never use third-party advertising cookies.
          </p>

          <Section title="1. Essential cookies (always on)">
            <p>
              Used to keep you signed in and to remember your session across pages. These cannot be
              disabled — without them the product doesn't work.
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-6 text-sm">
              <li><code>sb-*</code> — Supabase session cookies (httponly, secure)</li>
              <li><code>theme</code> — remembers your light/dark preference</li>
            </ul>
          </Section>

          <Section title="2. Analytics cookies (optional)">
            <p>
              We use a self-hosted, privacy-respecting analytics tool to understand which pages get
              used. We do not use Google Analytics. Data is aggregated and never sold.
            </p>
          </Section>

          <Section title="3. No advertising cookies">
            <p>
              We do not use Google Ads, Facebook Pixel, TikTok Pixel or any other advertising
              tracker. Ever. Our business model is subscriptions, not your data.
            </p>
          </Section>

          <Section title="4. How to opt out">
            <p>
              You can decline analytics cookies any time by clicking the "Essential only" button on
              the cookie banner. You can also clear your browser's cookies to reset your choice.
            </p>
          </Section>

          <Section title="5. Changes">
            <p>
              Material changes will be announced via the dashboard and on this page at least 30
              days before they take effect.
            </p>
          </Section>

          <p className="text-sm text-muted-foreground">
            Questions? Email{" "}
            <Link href="mailto:privacy@i-manage.app" className="text-primary underline">privacy@i-manage.app</Link>.
          </p>
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