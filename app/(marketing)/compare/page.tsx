import type { Metadata } from "next"
import Link from "next/link"
import { Check, X, ArrowUpRight } from "lucide-react"

export const metadata: Metadata = {
  title: "Compare — PropDesk Africa by Siemax Ltd",
  description: "How PropDesk Africa compares to spreadsheets, generic CRMs and US-built rent platforms.",
}

const rows: { label: string; us: boolean | string; spreadsheet: boolean | string; generic: boolean | string; usbuilt: boolean | string }[] = [
  { label: "Native M-Pesa STK Push", us: true, spreadsheet: false, generic: false, usbuilt: false },
  { label: "Airtel Money", us: true, spreadsheet: false, generic: false, usbuilt: false },
  { label: "Reconciliation engine", us: true, spreadsheet: false, generic: false, usbuilt: "Manual" },
  { label: "Tenant records (with KYC + history)", us: true, spreadsheet: false, generic: "Limited", usbuilt: true },
  { label: "Multi-currency (KES, UGX, TZS, NGN, USD)", us: true, spreadsheet: false, generic: "Limited", usbuilt: "USD only" },
  { label: "Document vault with OCR", us: true, spreadsheet: false, generic: "Add-on", usbuilt: "Add-on" },
  { label: "Quotations & approvals", us: true, spreadsheet: false, generic: false, usbuilt: false },
  { label: "Damages & inspections", us: true, spreadsheet: false, generic: false, usbuilt: "Add-on" },
  { label: "Public API + webhooks", us: true, spreadsheet: false, generic: false, usbuilt: "Limited" },
  { label: "Setup time", us: "15 min", spreadsheet: "1 day", generic: "1 week", usbuilt: "1 month" },
  { label: "Per-transaction fees", us: "0%", spreadsheet: "—", generic: "1.5%", usbuilt: "1%+" },
  { label: "Local support (EAT timezone)", us: true, spreadsheet: false, generic: false, usbuilt: false },
  { label: "DPA + GDPR-ready", us: true, spreadsheet: false, generic: true, usbuilt: true },
]

function Cell({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="mx-auto size-4 text-success" />
  if (value === false) return <X className="mx-auto size-4 text-muted-foreground/50" />
  return <span className="text-xs font-medium">{value}</span>
}

export default function ComparePage() {
  return (
    <>
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_50%_30%,#d9f45b,transparent_55%)]" />
        <div className="container-x relative pt-32 pb-16 lg:pt-44">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Compare</p>
          <h1 className="mt-6 text-5xl font-medium leading-[0.98] tracking-[-0.05em] sm:text-7xl">
            How we stack up.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-primary-foreground/70">
            An honest comparison of PropDesk Africa against spreadsheets, generic CRMs and US-built rent
            platforms. No "best in class" puffery.
          </p>
        </div>
      </section>

      <section className="bg-background py-12 lg:py-20">
        <div className="container-x">
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    <th className="px-5 py-4 text-left font-semibold">Capability</th>
                    <th className="px-5 py-4 text-center font-semibold text-foreground">PropDesk Africa</th>
                    <th className="px-5 py-4 text-center font-semibold">Spreadsheets</th>
                    <th className="px-5 py-4 text-center font-semibold">Generic CRM</th>
                    <th className="px-5 py-4 text-center font-semibold">US-built rent software</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {rows.map((r) => (
                    <tr key={r.label}>
                      <td className="px-5 py-4 text-left font-medium">{r.label}</td>
                      <td className="px-5 py-4 text-center"><Cell value={r.us} /></td>
                      <td className="px-5 py-4 text-center text-muted-foreground"><Cell value={r.spreadsheet} /></td>
                      <td className="px-5 py-4 text-center text-muted-foreground"><Cell value={r.generic} /></td>
                      <td className="px-5 py-4 text-center text-muted-foreground"><Cell value={r.usbuilt} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            Comparison data last verified Q3 2026. Spot something out of date?{" "}
            <Link href="/contact" className="font-medium text-primary underline">Tell us →</Link>
          </p>
        </div>
      </section>

      <section className="bg-accent text-accent-foreground py-20">
        <div className="container-x text-center">
          <h2 className="mx-auto max-w-2xl text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-4xl">
            Ready to switch?
          </h2>
          <Link
            href="/auth/sign-up"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Start free <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </section>
    </>
  )
}