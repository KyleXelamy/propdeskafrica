"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowUpRight, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export type MegaSection = {
  label: string
  href: string
  description?: string
  icon?: React.ComponentType<{ className?: string }>
  featured?: {
    eyebrow: string
    title: string
    body: string
    href: string
    cta: string
  }
  groups?: {
    heading: string
    items: { label: string; href: string; description?: string }[]
  }[]
}

export function MegaMenu({ sections, className }: { sections: MegaSection[]; className?: string }) {
  const [open, setOpen] = useState<string | null>(null)

  return (
    <nav
      aria-label="Primary"
      className={cn("hidden items-center gap-1 lg:flex", className)}
      onMouseLeave={() => setOpen(null)}
    >
      {sections.map((s) => {
        const isOpen = open === s.label
        return (
          <div
            key={s.label}
            className="relative"
            onMouseEnter={() => setOpen(s.label)}
          >
            <Link
              href={s.href}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                isOpen ? "text-accent" : "text-white/75 hover:text-white",
              )}
            >
              {s.label}
              {(s.groups || s.featured) && (
                <ChevronDown
                  className={cn(
                    "size-3.5 transition-transform",
                    isOpen && "rotate-180",
                  )}
                />
              )}
            </Link>

            {isOpen && (s.groups || s.featured) && (
              <div className="absolute left-1/2 top-full z-40 -translate-x-1/2 pt-3">
                <div className="w-[760px] max-w-[92vw] overflow-hidden rounded-3xl border border-border bg-card text-foreground shadow-2xl">
                  <div className="grid grid-cols-3">
                    <div className="col-span-2 grid grid-cols-2 gap-x-8 gap-y-8 p-8">
                      {s.groups?.map((g) => (
                        <div key={g.heading}>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            {g.heading}
                          </p>
                          <ul className="mt-4 space-y-3">
                            {g.items.map((it) => (
                              <li key={it.href}>
                                <Link
                                  href={it.href}
                                  className="group block"
                                >
                                  <p className="text-sm font-medium leading-tight text-foreground group-hover:text-primary">
                                    {it.label}
                                  </p>
                                  {it.description && (
                                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                                      {it.description}
                                    </p>
                                  )}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                    {s.featured && (
                      <div className="border-l border-border bg-secondary/40 p-7">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          {s.featured.eyebrow}
                        </p>
                        <p className="mt-3 text-base font-medium leading-snug">
                          {s.featured.title}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {s.featured.body}
                        </p>
                        <Link
                          href={s.featured.href}
                          className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                        >
                          {s.featured.cta} <ArrowUpRight className="size-3.5" />
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}