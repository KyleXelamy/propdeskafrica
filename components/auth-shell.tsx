import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { BrandWordmark } from "@/components/brand-mark"

/**
 * Branded split layout shared by /auth/login and /auth/sign-up.
 * Dark left panel hosts the marketing pitch; right panel hosts the form.
 */
export function AuthShell({
  eyebrow,
  title,
  body,
  footerPrompt,
  footerHref,
  footerLabel,
  children,
}: {
  eyebrow: string
  title: string
  body: string
  footerPrompt: string
  footerHref: string
  footerLabel: string
  children: React.ReactNode
}) {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Pitch side */}
      <aside className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex">
        <div className="absolute inset-0 opacity-[0.06] bg-[radial-gradient(circle_at_20%_20%,#d9f45b,transparent_55%)]" />
        <div className="absolute inset-0 opacity-[0.06] bg-[radial-gradient(circle_at_90%_90%,#d9f45b,transparent_45%)]" />

        <div className="relative z-10 flex h-full flex-col p-10">
          <BrandWordmark href="/" showSubtitle={false} size="lg" className="text-primary-foreground" />

          <div className="my-auto max-w-md">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">{eyebrow}</p>
            <h1 className="mt-6 text-4xl font-medium leading-[1.05] tracking-[-0.04em] sm:text-5xl">
              {title}
            </h1>
            <p className="mt-6 text-base leading-7 text-primary-foreground/70">{body}</p>

            <ul className="mt-10 space-y-3 text-sm text-primary-foreground/75">
              {[
                "Manage tenants, units and leases in one place",
                "Native M-Pesa rent collection",
                "Unlimited units on one flat monthly price",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-accent" />
                  {item}
                </li>
              ))}
            </ul>

            <Link
              href="/contact"
              className="mt-10 inline-flex items-center gap-2 text-sm font-medium text-accent hover:text-accent/90"
            >
              Talk to the team <ArrowUpRight className="size-4" />
            </Link>
          </div>

          <p className="text-xs text-primary-foreground/40">
            © {new Date().getFullYear()} PropDesk Africa. All rights reserved.
          </p>
        </div>
      </aside>

      {/* Form side */}
      <main className="flex items-center justify-center bg-background px-6 py-12 sm:px-10">
        <div className="w-full max-w-md">
          {/* Mobile-only top brand */}
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <BrandWordmark href="/" showSubtitle size="md" />
            <Link href={footerHref} className="text-sm text-muted-foreground hover:text-primary">
              {footerLabel}
            </Link>
          </div>

          {children}

          {/* Desktop footer prompt */}
          <p className="mt-8 hidden text-center text-sm text-muted-foreground lg:block">
            {footerPrompt}{" "}
            <Link href={footerHref} className="font-medium text-primary hover:underline">
              {footerLabel}
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
