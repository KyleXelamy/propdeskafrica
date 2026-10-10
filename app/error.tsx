"use client"

import { useEffect } from "react"
import Link from "next/link"
import { ArrowUpRight, Home, RefreshCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Forward to whatever observability stack you wire up later
    // (Sentry, PostHog, etc.). For now: console only.
    console.error("[propdeskafrica] route error", { message: error.message, digest: error.digest })
  }, [error])

  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-[0.08] bg-[radial-gradient(circle_at_50%_50%,#d9f45b,transparent_55%)]" />
        <div className="container-x relative flex min-h-[60vh] flex-col items-start justify-center pt-24 pb-16">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Error</p>
          <h1 className="mt-6 max-w-3xl text-5xl font-medium leading-[0.98] tracking-[-0.05em] sm:text-7xl">
            Something went sideways.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-primary-foreground/70">
            We hit an unexpected error rendering this page. It&apos;s been logged and we&apos;ll
            look at it. Try the action below or head back home.
          </p>
          {error.digest && (
            <p className="mt-6 max-w-xl font-mono text-xs text-primary-foreground/55">
              Reference: {error.digest}
            </p>
          )}
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Button onClick={() => reset()} className="rounded-full bg-accent px-7 text-primary hover:bg-accent/90">
              <RefreshCcw className="mr-2 size-4" /> Try again
            </Button>
            <Button
              asChild
              variant="outline"
              className="rounded-full border-primary-foreground/30 bg-transparent px-7 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <Link href="/">
                <Home className="mr-2 size-4" /> Home <ArrowUpRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}