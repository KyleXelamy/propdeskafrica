import type { Metadata } from "next"
import Link from "next/link"
import { Download } from "lucide-react"
import { templates } from "@/lib/content/marketing"

export const metadata: Metadata = {
  title: "Templates — PropDesk Africa by Siemax Ltd",
  description: "Free lease agreements, condition reports, notices and CSV templates for Kenyan landlords.",
}

const formatBadge: Record<string, string> = {
  PDF: "bg-destructive/10 text-destructive",
  DOCX: "bg-primary/10 text-primary",
  CSV: "bg-success/10 text-success",
}

const formatNote: Record<string, string> = {
  PDF: "PDF",
  DOCX: "Word document",
  CSV: "CSV · import-ready",
}

/**
 * Derived from the catalogue, not hand-listed. A hardcoded list silently
 * hides any category someone adds later.
 */
const categories = Array.from(new Set(templates.map((t) => t.category))).sort()

export default function TemplatesPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_50%_30%,#d9f45b,transparent_55%)]" />
        <div className="container-x relative pt-32 pb-16 lg:pt-44">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Templates</p>
          <h1 className="mt-6 text-5xl font-medium leading-[0.98] tracking-[-0.05em] sm:text-7xl">
            Free downloads. Real paperwork.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-primary-foreground/70">
            Lease agreements, inspection checklists, notices and CSV templates prepared for East African property teams. Adapt them to your situation before use.
          </p>
        </div>
      </section>

      <section className="bg-background py-12">
        <div className="container-x">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/templates"
              className="rounded-full border border-primary bg-primary px-4 py-1.5 text-sm text-primary-foreground"
            >
              All ({templates.length})
            </Link>
            {categories.map((c) => {
              const count = templates.filter((t) => t.category === c).length
              return (
                <Link
                  key={c}
                  href={`/templates?category=${c}`}
                  className="rounded-full border border-border bg-card px-4 py-1.5 text-sm text-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  {c} ({count})
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {categories.map((cat) => {
        const items = templates.filter((t) => t.category === cat)
        if (items.length === 0) return null
        return (
          <section key={cat} className="bg-background py-8 first-of-type:pt-4 lg:py-12">
            <div className="container-x">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{cat}</p>
              <h2 className="mt-3 text-2xl font-medium leading-tight tracking-[-0.04em]">{cat} templates</h2>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((t) => (
                  <li key={t.slug} className="rounded-2xl border border-border bg-card p-5">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${formatBadge[t.format]}`}>
                        {t.format}
                      </span>
                      <span className="text-xs text-muted-foreground">{t.region}</span>
                    </div>
                    <p className="mt-4 text-base font-medium leading-tight">{t.name}</p>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.description}</p>
                    {t.legalBasis ? (
                      <p className="mt-3 text-xs leading-relaxed text-muted-foreground/80">
                        <span className="font-medium text-foreground/70">Basis:</span> {t.legalBasis}
                      </p>
                    ) : null}
                    <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                      <span className="text-xs text-muted-foreground">
                        {formatNote[t.format] ?? t.format}
                      </span>
                      <a
                        href={t.downloadPath}
                        download
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                      >
                        <Download className="size-3.5" /> Download
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )
      })}

      <section className="bg-accent text-accent-foreground py-16">
        <div className="container-x text-center">
          <h2 className="mx-auto max-w-2xl text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-4xl">
            Don't see what you need?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-base text-accent-foreground/80">
            Request a template and we'll have it reviewed by a lawyer within 2 weeks.
          </p>
          <Link
            href="/contact"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Request a template
          </Link>
        </div>
      </section>
    </>
  )
}
