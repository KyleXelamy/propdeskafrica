import type { Metadata } from "next"
import { subProcessors } from "@/lib/content/marketing"

export const metadata: Metadata = {
  title: "Sub-processors — PropDesk Africa by Siemax Ltd",
  description: "The list of sub-processors that handle PropDesk Africa customer data.",
}

export default function SubProcessorsPage() {
  return (
    <article className="bg-background py-16 lg:py-20">
      <section className="bg-primary text-primary-foreground">
        <div className="container-x pt-32 pb-12 lg:pt-44">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Trust</p>
          <h1 className="mt-6 text-5xl font-medium leading-[0.98] tracking-[-0.05em] sm:text-7xl">
            Sub-processors
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-primary-foreground/70">
            The third parties that handle PropDesk Africa customer data on our behalf. We notify customers
            at least 30 days before adding or replacing a sub-processor.
          </p>
        </div>
      </section>

      <div className="container-x py-16">
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <th className="px-5 py-4 font-semibold">Sub-processor</th>
                <th className="px-5 py-4 font-semibold">Purpose</th>
                <th className="px-5 py-4 font-semibold">Data</th>
                <th className="px-5 py-4 font-semibold">Region</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {subProcessors.map((s) => (
                <tr key={s.name}>
                  <td className="px-5 py-4 font-medium">{s.name}</td>
                  <td className="px-5 py-4 text-muted-foreground">{s.purpose}</td>
                  <td className="px-5 py-4 text-muted-foreground">{s.data}</td>
                  <td className="px-5 py-4 text-muted-foreground">{s.region}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          Last updated 1 October 2026. Subscribe to{" "}
          <a href="/rss.xml" className="font-medium text-primary underline">
            our RSS feed
          </a>{" "}
          to be notified of changes.
        </p>
      </div>
    </article>
  )
}