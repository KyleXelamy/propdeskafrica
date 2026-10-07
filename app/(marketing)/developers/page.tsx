import type { Metadata } from "next"
import Link from "next/link"
import { ArrowUpRight, Code2, Webhook, KeyRound, FileJson, Terminal, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Developers — I-Manage by Siemax Ltd",
  description: "REST API, webhooks, OAuth and an OpenAPI spec for I-Manage.",
}

const endpoints = [
  { method: "GET", path: "/api/properties", desc: "List all properties" },
  { method: "POST", path: "/api/properties", desc: "Create a property" },
  { method: "GET", path: "/api/tenants", desc: "List all tenants" },
  { method: "POST", path: "/api/payments", desc: "Record a payment" },
  { method: "POST", path: "/api/mpesa/stkpush", desc: "Initiate M-Pesa STK Push" },
  { method: "GET", path: "/api/tenants", desc: "List all tenants" },
  { method: "POST", path: "/api/support", desc: "Create a support ticket" },
  { method: "GET", path: "/api/quotations", desc: "List maintenance quotations" },
  { method: "POST", path: "/api/damages", desc: "Log a damage" },
  { method: "GET", path: "/api/dashboard", desc: "Aggregate dashboard data" },
]

const events = [
  "payment.received",
  "payment.failed",
  "tenant.invited",
  "tenant.activated",
  "maintenance.requested",
  "maintenance.completed",
  "lease.expiring",
  "document.uploaded",
  "document.expiring",
  "expense.recorded",
  "property.created",
  "webhook.test",
]

export default function DevelopersPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(21,35,29,.98)_12%,rgba(21,35,29,.6)_82%,transparent),url('https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=2200&q=80')] bg-cover bg-center" />
        <div className="container-x relative pt-32 pb-20 lg:pt-44 lg:pb-28">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Developers</p>
            <h1 className="mt-6 text-5xl font-medium leading-[0.98] tracking-[-0.05em] sm:text-7xl">
              Build on the platform landlords love.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-primary-foreground/70">
              A REST API, signed webhooks, OAuth 2.0 and a real OpenAPI spec. Plus sandbox keys and
              an OpenAPI explorer so you can ship in an afternoon, not a quarter.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="rounded-full bg-accent px-7 text-primary hover:bg-accent/90">
                <Link href="/contact/sales">Request API access <ArrowUpRight data-icon="inline-end" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full border-primary-foreground/30 bg-transparent px-7 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
                <Link href="/docs">Read the docs</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-background py-12">
        <div className="container-x grid gap-6 sm:grid-cols-3">
          {[
            { k: "40+", v: "REST endpoints" },
            { k: "12", v: "Webhook event types" },
            { k: "99.99%", v: "Webhook delivery" },
          ].map((s) => (
            <div key={s.k} className="rounded-2xl border border-border bg-card p-6">
              <p className="text-3xl font-medium tracking-tight">{s.k}</p>
              <p className="mt-2 text-sm text-muted-foreground">{s.v}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Endpoints */}
      <section className="bg-secondary/40 py-20 lg:py-24">
        <div className="container-x grid gap-12 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">REST API</p>
            <h2 className="mt-4 text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-4xl">
              Resources you already think in.
            </h2>
            <p className="mt-5 max-w-md text-base leading-7 text-muted-foreground">
              Every entity in I-Manage has a REST endpoint. List, fetch, create, update, delete — with
              consistent auth, pagination and error handling.
            </p>
            <div className="mt-6 flex flex-col gap-3 text-sm">
              <Link href="/docs" className="inline-flex items-center gap-2 text-primary hover:underline">
                <BookOpen className="size-4" /> Read the full reference
              </Link>
              <Link href="/api/openapi.json" className="inline-flex items-center gap-2 text-primary hover:underline">
                <FileJson className="size-4" /> Download OpenAPI spec
              </Link>
              <Link href="/docs/category/api" className="inline-flex items-center gap-2 text-primary hover:underline">
                <Terminal className="size-4" /> Try the API explorer
              </Link>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-5 py-3 text-xs">
              <span className="size-2.5 rounded-full bg-destructive" />
              <span className="size-2.5 rounded-full bg-warning" />
              <span className="size-2.5 rounded-full bg-success" />
              <span className="ml-3 font-mono text-muted-foreground">bknglabs.dev/api</span>
            </div>
            <ul className="divide-y divide-border font-mono text-sm">
              {endpoints.map((e) => (
                <li key={e.path + e.method} className="flex items-center gap-4 px-5 py-3">
                  <span
                    className={
                      "shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold " +
                      (e.method === "GET" ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground")
                    }
                  >
                    {e.method}
                  </span>
                  <span className="text-foreground">{e.path}</span>
                  <span className="ml-auto truncate text-xs text-muted-foreground">{e.desc}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Webhooks */}
      <section className="bg-background py-20 lg:py-24">
        <div className="container-x grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-2xl border border-border bg-card p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Webhook events</p>
            <h3 className="mt-3 text-2xl font-medium tracking-[-0.02em]">Real-time, signed, retried.</h3>
            <p className="mt-3 text-sm text-muted-foreground">
              Every webhook is signed with HMAC-SHA256, retried with exponential backoff for 24
              hours, and inspectable from your dashboard.
            </p>
            <ul className="mt-6 grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-3">
              {events.map((e) => (
                <li key={e} className="rounded-md border border-border bg-background px-3 py-2 text-muted-foreground">
                  {e}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-6">
            <Feature icon={Code2} title="REST everywhere" body="Every entity, every action, one consistent shape." />
            <Feature icon={Webhook} title="Signed webhooks" body="HMAC-SHA256, replay-safe, retried for 24h." />
            <Feature icon={KeyRound} title="OAuth 2.0" body="Authorization-code flow with granular scopes." />
            <Feature icon={FileJson} title="OpenAPI 3.1" body="Generate clients, validate, explore." />
          </div>
        </div>
      </section>
    </>
  )
}

function Feature({ icon: Icon, title, body }: { icon: React.ComponentType<{ className?: string }>; title: string; body: string }) {
  return (
    <div className="flex items-start gap-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
        <Icon className="size-5" />
      </span>
      <div>
        <p className="text-base font-medium leading-tight">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  )
}
