import type { Metadata } from "next"
import Link from "next/link"
import { ArrowUpRight, CheckCircle2, AlertCircle } from "lucide-react"
import { systemComponents, statusIncidents } from "@/lib/content/site"

export const metadata: Metadata = {
  title: "Status — I-Manage by Siemax Ltd",
  description:
    "Real-time operational status for I-Manage: marketing site, dashboard, M-Pesa integration and webhooks.",
}

const allOperational = true

export default function StatusPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_20%_30%,#d9f45b,transparent_55%)]" />
        <div className="container-x relative pt-40 pb-16 lg:pt-52">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">System status</p>
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
            <h1 className="text-5xl font-medium leading-[0.98] tracking-[-0.05em] sm:text-6xl">
              All systems operational
            </h1>
            <span
              className={`inline-flex items-center gap-2 self-start rounded-full px-3 py-1.5 text-xs font-semibold sm:self-auto ${
                allOperational ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
              }`}
            >
              <span
                className={`size-2 rounded-full ${allOperational ? "bg-success" : "bg-warning"} animate-pulse`}
              />
              {allOperational ? "Operational" : "Degraded"}
            </span>
          </div>
          <p className="mt-4 max-w-xl text-base text-primary-foreground/65">
            Updated continuously. Subscribe to{" "}
            <Link href="/api/status" className="underline">
              our status API
            </Link>{" "}
            for machine-readable output.
          </p>
        </div>
      </section>

      <section className="bg-background py-16">
        <div className="container-x">
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {systemComponents.map((c, i) => (
              <div
                key={c.key}
                className={`flex items-center justify-between gap-6 p-5 ${
                  i < systemComponents.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <div>
                  <p className="text-base font-medium">{c.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-success/15 px-3 py-1.5 text-xs font-medium text-success">
                  <CheckCircle2 className="size-3.5" /> Operational
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-secondary/40 py-20 lg:py-24">
        <div className="container-x max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Recent incidents</p>
          <h2 className="mt-4 text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-4xl">
            90-day incident history.
          </h2>

          {statusIncidents.length === 0 ? (
            <p className="mt-8 text-base text-muted-foreground">No incidents in the last 90 days. 🌱</p>
          ) : (
            <ul className="mt-10 space-y-6">
              {statusIncidents.map((i) => (
                <li key={i.id} className="rounded-2xl border border-border bg-card p-6">
                  <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    <span>{new Date(i.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                    <span aria-hidden>·</span>
                    <span>{i.id}</span>
                    <span
                      className={`ml-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] ${
                        i.severity === "critical"
                          ? "bg-destructive/15 text-destructive"
                          : i.severity === "major"
                          ? "bg-warning/15 text-warning"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <AlertCircle className="size-3" /> {i.severity}
                    </span>
                    <span className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-[10px] text-success">
                      {i.status}
                    </span>
                  </div>
                  <h3 className="mt-3 text-xl font-medium leading-tight tracking-[-0.03em]">{i.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-foreground/85">{i.body}</p>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-10 text-sm text-muted-foreground">
            Need to report something? Email{" "}
            <Link href="mailto:status@i-manage.app" className="font-medium text-primary underline">
              status@i-manage.app
            </Link>
            .
          </p>
        </div>
      </section>

    </main>
  )
}