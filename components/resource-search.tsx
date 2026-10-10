"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Search } from "lucide-react"
import { blogPosts } from "@/lib/content/blog"

type Mode = "all" | "post" | "page"

type SearchItem = {
  title: string
  description: string
  href: string
  kind: string
  meta?: string
}

const PAGES: SearchItem[] = [
  { title: "Pricing", description: "Solo, Pro and Agency plans. Honest pricing, no transaction fees.", href: "/pricing", kind: "Page" },
  { title: "Customers", description: "A transparent look at an early-stage property management platform.", href: "/customers", kind: "Page" },
  { title: "About", description: "The team building PropDesk Africa and the values we ship by.", href: "/about", kind: "Page" },
  { title: "Changelog", description: "Every product update, improvement and fix.", href: "/changelog", kind: "Page" },
  { title: "Careers", description: "Open roles in engineering, design and operations.", href: "/careers", kind: "Page" },
  { title: "Contact", description: "Reach the team — humans reply within one business day.", href: "/contact", kind: "Page" },
  { title: "Security", description: "How we protect your data, and how to report a vulnerability.", href: "/security", kind: "Page" },
  { title: "Help & FAQ", description: "Common questions and how to contact support.", href: "/help", kind: "Page" },
  { title: "Integrations", description: "M-Pesa, Airtel, Xero, WhatsApp, Slack and more.", href: "/integrations", kind: "Page" },
  { title: "Status", description: "Real-time operational status for every component.", href: "/status", kind: "Page" },
  { title: "Press", description: "Press kit, coverage and media contacts.", href: "/press", kind: "Page" },
  { title: "Privacy policy", description: "How we collect, use and protect your data.", href: "/legal/privacy", kind: "Legal" },
  { title: "Terms of service", description: "The terms governing your use of PropDesk Africa.", href: "/legal/terms", kind: "Legal" },
  { title: "Data Processing Agreement", description: "GDPR-aligned DPA for Agency and enterprise customers.", href: "/legal/dpa", kind: "Legal" },
]

const POSTS: SearchItem[] = blogPosts.map((p) => ({
  title: p.title,
  description: p.excerpt,
  href: `/resources/${p.slug}`,
  kind: "Article",
  meta: `${p.category} · ${p.readingMinutes} min`,
}))

const ALL: SearchItem[] = [...POSTS, ...PAGES]

export function ResourceSearch({ mode = "all" }: { mode?: Mode }) {
  const [q, setQ] = useState("")

  const items = useMemo(() => {
    const filtered = mode === "post" ? POSTS : mode === "page" ? PAGES : ALL
    if (!q.trim()) return filtered.slice(0, 8)
    const needle = q.toLowerCase()
    return filtered
      .filter(
        (i) =>
          i.title.toLowerCase().includes(needle) ||
          i.description.toLowerCase().includes(needle),
      )
      .slice(0, 12)
  }, [q, mode])

  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <Search className="size-4 text-muted-foreground" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={
            mode === "post"
              ? "Search articles…"
              : mode === "page"
              ? "Search pages…"
              : "Search resources, pages, legal…"
          }
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>
      <ul className="divide-y divide-border">
        {items.length === 0 ? (
          <li className="p-6 text-sm text-muted-foreground">No results for &ldquo;{q}&rdquo;.</li>
        ) : (
          items.map((i) => (
            <li key={i.href}>
              <Link
                href={i.href}
                className="flex flex-col gap-1 p-5 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight">{i.title}</p>
                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{i.description}</p>
                </div>
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {i.meta || i.kind}
                </span>
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
