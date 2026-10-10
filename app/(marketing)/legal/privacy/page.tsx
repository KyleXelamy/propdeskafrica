import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Privacy policy — PropDesk Africa by Siemax Ltd",
  description: "How PropDesk Africa collects, uses and protects your data.",
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="bg-primary text-primary-foreground">
        <div className="container-x pt-40 pb-16 lg:pt-52">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Legal</p>
          <h1 className="mt-6 text-5xl font-medium leading-[0.98] tracking-[-0.05em] sm:text-7xl">
            Privacy policy
          </h1>
          <p className="mt-6 text-sm text-primary-foreground/55">Last updated: 1 October 2026</p>
        </div>
      </section>

      <article className="container-x max-w-3xl py-16 lg:py-20">
        <div className="space-y-8 text-base leading-8 text-foreground/85">
          <p>
            PropDesk Africa is operated by Siemax Ltd ("we", "us", "our"). This policy explains what data we
            collect, why we collect it, and what choices you have. We've written it in plain language
            on purpose — if anything is unclear, write to us at{" "}
            <Link href="mailto:bknglabs.dev@gmail.com" className="text-primary underline">bknglabs.dev@gmail.com</Link>.
          </p>

          <Section title="1. What we collect">
            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li><b>Account data</b> — your name, email, phone and any profile details you add.</li>
              <li><b>Property data</b> — properties, tenants, leases, payments, expenses, documents you upload.</li>
              <li><b>Usage data</b> — pages visited, actions taken, device and browser metadata.</li>
              <li><b>Payment metadata</b> — M-Pesa transaction IDs, amounts, timestamps. We never see your M-Pesa PIN.</li>
            </ul>
          </Section>

          <Section title="2. Why we collect it">
            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>To provide the PropDesk Africa product and sync your data across devices.</li>
              <li>To process rent and expense transactions on your behalf.</li>
              <li>To send important service notifications (rent received, lease expiring, etc.).</li>
              <li>To improve the product and prevent abuse.</li>
            </ul>
          </Section>

          <Section title="3. Where it's stored">
            <p>
              Your data is stored in our Supabase (PostgreSQL) project, hosted on AWS. Backups are
              encrypted at rest and in transit. We use Supabase's row-level security to ensure that
              one landlord can never see another landlord's data.
            </p>
          </Section>

          <Section title="4. Who we share it with">
            <p>We never sell your data. We share it only with:</p>
            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li><b>Safaricom Daraja</b> — to process M-Pesa payments you initiate.</li>
              <li><b>Supabase / AWS</b> — to host the database.</li>
              <li><b>Resend / SendGrid</b> — to deliver transactional emails.</li>
              <li><b>Vercel</b> — to host the web application.</li>
            </ul>
          </Section>

          <Section title="5. Your rights">
            <p>
              You can export, correct or delete your data at any time from <Link href="/dashboard/settings" className="text-primary underline">Settings → Data</Link>.
              You can also email <Link href="mailto:bknglabs.dev@gmail.com" className="text-primary underline">bknglabs.dev@gmail.com</Link> and we will respond within
              7 business days.
            </p>
          </Section>

          <Section title="6. Cookies">
            <p>
              We use essential cookies for authentication and a small set of analytics cookies to understand
              how the product is used. No third-party advertising cookies — ever.
            </p>
          </Section>

          <Section title="7. Changes to this policy">
            <p>
              If we make material changes, we'll email every active account and show a banner in the
              dashboard at least 30 days before the changes take effect.
            </p>
          </Section>
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
