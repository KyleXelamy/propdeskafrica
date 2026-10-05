import Link from "next/link"
import { ArrowUpRight, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MarketingHeader, MarketingFooter } from "@/components/marketing-site"

export default function NotFound() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-[0.08] bg-[radial-gradient(circle_at_50%_50%,#d9f45b,transparent_55%)]" />
        <MarketingHeader />
        <div className="container-x relative flex min-h-[60vh] flex-col items-start justify-center pt-32 pb-20 lg:pt-44">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Error 404</p>
          <h1 className="mt-6 max-w-3xl text-6xl font-medium leading-[0.95] tracking-[-0.05em] sm:text-8xl">
            We can&apos;t find that page.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-primary-foreground/70">
            It may have been moved, renamed, or never existed. Try one of the routes below — or get in
            touch if you think we broke something.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="rounded-full bg-accent px-7 text-primary hover:bg-accent/90">
              <Link href="/">
                <Home className="mr-2 size-4" /> Back to home
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full border-primary-foreground/30 bg-transparent px-7 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <Link href="/contact">Report a broken link <ArrowUpRight data-icon="inline-end" /></Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="bg-background py-20">
        <div className="container-x">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Popular destinations</p>
          <h2 className="mt-4 text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-4xl">
            Where were you headed?
          </h2>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: "Pricing", href: "/pricing" },
              { label: "Customers", href: "/customers" },
              { label: "Resources", href: "/resources" },
              { label: "Changelog", href: "/changelog" },
              { label: "Help & FAQ", href: "/help" },
              { label: "Status", href: "/status" },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="group flex items-center justify-between rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary"
              >
                <span className="text-base font-medium">{l.label}</span>
                <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  )
}