import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Data Processing Agreement — PropDesk Africa by PropDesk Africa Ltd",
  description:
    "PropDesk Africa's Data Processing Agreement for Agency and enterprise customers.",
}

export default function DPAPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="bg-primary text-primary-foreground">
        <div className="container-x pt-40 pb-12 lg:pt-52">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Legal</p>
          <h1 className="mt-6 text-5xl font-medium leading-[0.98] tracking-[-0.05em] sm:text-7xl">
            Data Processing Agreement
          </h1>
          <p className="mt-6 text-sm text-primary-foreground/55">Last updated: 1 October 2026</p>
        </div>
      </section>

      <article className="container-x max-w-3xl py-16 lg:py-20">
        <div className="space-y-8 text-base leading-8 text-foreground/85">
          <p>
            This Data Processing Agreement ("DPA") forms part of the PropDesk Africa Terms of Service and
            applies wherever PropDesk Africa processes personal data on behalf of a customer. It is designed
            to meet the requirements of Article 28 of the EU GDPR and equivalent provisions in other
            jurisdictions.
          </p>

          <Section title="1. Roles">
            <p>
              The customer is the <strong>Data Controller</strong>. PropDesk Africa Ltd, operating PropDesk Africa,
              is the <strong>Data Processor</strong>. Where PropDesk Africa engages a sub-processor (e.g.
              Supabase, Resend, Vercel), PropDesk Africa acts as Data Processor and the sub-processor acts on
              PropDesk Africa's documented instructions.
            </p>
          </Section>

          <Section title="2. Subject matter & duration">
            <p>
              PropDesk Africa processes the personal data described in our <Link href="/legal/privacy" className="text-primary underline">privacy policy</Link>{" "}
              solely for the purpose of providing the PropDesk Africa service, for the duration of the
              customer's subscription and any post-termination wind-down period not exceeding 90 days.
            </p>
          </Section>

          <Section title="3. Nature & purpose of processing">
            <p>
              Processing includes collection, storage, organisation, retrieval, consultation, use,
              disclosure, alignment, restriction and deletion of personal data — exclusively to operate
              the dashboard, tenant records, payment processing and related notifications.
            </p>
          </Section>

          <Section title="4. Categories of data">
            <p>Personal data of:</p>
            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>Landlords — name, email, phone, billing details.</li>
              <li>Tenants — name, email, phone, lease & payment history.</li>
              <li>End-customers of tenants — only where the landlord chooses to record them.</li>
            </ul>
            <p className="mt-4">Special categories of data: none processed by default.</p>
          </Section>

          <Section title="5. Sub-processors">
            <p>
              Current sub-processors and the data they handle are listed below. We notify customers
              at least 30 days before adding or replacing a sub-processor, and customers may object
              on reasonable grounds.
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>Supabase (PostgreSQL hosting) — primary database.</li>
              <li>Vercel — application hosting and edge functions.</li>
              <li>Resend / SendGrid — transactional email.</li>
              <li>Safaricom Daraja — M-Pesa payment processing (data subject to Daraja's own policies).</li>
              <li>Amazon Web Services — backup storage (encrypted).</li>
            </ul>
          </Section>

          <Section title="6. Security measures">
            <p>
              PropDesk Africa maintains the technical and organisational measures described on our{" "}
              <Link href="/security" className="text-primary underline">security page</Link>,
              including encryption in transit and at rest, row-level security, audit logging, and
              least-privilege staff access.
            </p>
          </Section>

          <Section title="7. Data subject rights">
            <p>
              PropDesk Africa will assist the customer in responding to data subject requests (access, correction,
              deletion, portability, objection) within statutory timeframes. The customer may submit
              such requests directly through their PropDesk Africa dashboard.
            </p>
          </Section>

          <Section title="8. International transfers">
            <p>
              Personal data is primarily stored in the EU (Frankfurt) and Kenya (Nairobi) regions.
              Cross-border transfers rely on Standard Contractual Clauses or equivalent safeguards.
              Customers may request region locking on Agency and Enterprise plans.
            </p>
          </Section>

          <Section title="9. Breach notification">
            <p>
              PropDesk Africa will notify the customer without undue delay, and in any case within 48 hours,
              after becoming aware of a personal data breach affecting the customer's data.
            </p>
          </Section>

          <Section title="10. Deletion on termination">
            <p>
              Within 90 days of subscription termination, PropDesk Africa will delete all personal data
              associated with the customer account, except where retention is mandated by law (e.g.
              financial records for 7 years).
            </p>
          </Section>

          <Section title="11. Liability & order of precedence">
            <p>
              In the event of a conflict between this DPA and the Terms of Service, this DPA
              prevails with respect to the processing of personal data.
            </p>
          </Section>

          <Section title="12. Contact">
            <p>
              Questions about this DPA? Email{" "}
              <Link href="mailto:bknglabs.dev@gmail.com" className="text-primary underline">bknglabs.dev@gmail.com</Link>.
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
