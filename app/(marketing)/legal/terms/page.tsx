import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Terms of service — I-Manage by Siemax Ltd",
  description: "The terms and conditions for using I-Manage.",
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="bg-primary text-primary-foreground">
        <div className="container-x pt-40 pb-16 lg:pt-52">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Legal</p>
          <h1 className="mt-6 text-5xl font-medium leading-[0.98] tracking-[-0.05em] sm:text-7xl">
            Terms of service
          </h1>
          <p className="mt-6 text-sm text-primary-foreground/55">Last updated: 1 October 2026</p>
        </div>
      </section>

      <article className="container-x max-w-3xl py-16 lg:py-20">
        <div className="space-y-8 text-base leading-8 text-foreground/85">
          <p>
            These terms govern your use of I-Manage, operated by Siemax Ltd ("we", "us"). By creating
            an account you agree to them. If you don't agree, please don't use the service.
          </p>

          <Section title="1. Your account">
            <p>
              You're responsible for keeping your credentials secure and for activity that happens under
              your account. Use a unique password and turn on two-factor authentication when we offer it.
            </p>
          </Section>

          <Section title="2. Acceptable use">
            <p>You agree not to:</p>
            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>Use I-Manage to harass tenants or third parties.</li>
              <li>Upload content that is illegal in your jurisdiction.</li>
              <li>Attempt to access data belonging to other landlords.</li>
              <li>Reverse engineer, resell or white-label the service without written permission.</li>
            </ul>
          </Section>

          <Section title="3. Billing">
            <p>
              Paid plans are billed monthly or annually in advance. You can cancel at any time and keep
              access through the end of your billing period. We don't charge setup, cancellation or
              per-transaction fees on rent.
            </p>
          </Section>

          <Section title="4. Data ownership">
            <p>
              You own the data you put into I-Manage. We act as a data processor on your behalf and
              will never sell, rent, or share it for advertising.
            </p>
          </Section>

          <Section title="5. Service availability">
            <p>
              We aim for 99.9% uptime but the service is provided "as is". For planned maintenance we
              give at least 48 hours notice via the dashboard and your registered email.
            </p>
          </Section>

          <Section title="6. Limitation of liability">
            <p>
              To the maximum extent permitted by law, our total liability for any claim arising from
              your use of I-Manage is limited to the amount you paid us in the 12 months preceding the
              claim. We are not liable for indirect or consequential damages.
            </p>
          </Section>

          <Section title="7. Termination">
            <p>
              You can delete your account at any time from Settings. We may suspend or terminate
              accounts that violate these terms. Where possible, we'll warn you first.
            </p>
          </Section>

          <Section title="8. Governing law">
            <p>
              These terms are governed by the laws of the Republic of Kenya. Disputes will be resolved
              in the courts of Nairobi.
            </p>
          </Section>

          <Section title="9. Contact">
            <p>
              Questions about these terms? Write to{" "}
              <Link href="mailto:legal@i-manage.app" className="text-primary underline">legal@i-manage.app</Link>.
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