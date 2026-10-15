import type { Metadata } from "next"
import Link from "next/link"
import { Download } from "lucide-react"
import { brandAssets } from "@/lib/content/marketing"

export const metadata: Metadata = {
  title: "Brand kit — PropDesk Africa",
  description: "Logos, color palette, typography and product photography for the PropDesk Africa brand.",
}

const colors = [
  { name: "Brand ink", hex: "#15231d", bg: "bg-[#15231d]" },
  { name: "Brand lime", hex: "#d9f45b", bg: "bg-[#d9f45b]" },
  { name: "Brand cream", hex: "#f4f3ed", bg: "bg-[#f4f3ed]" },
  { name: "Sage deep", hex: "#45604d", bg: "bg-[#45604d]" },
  { name: "Sage", hex: "#5d6a5f", bg: "bg-[#5d6a5f]" },
  { name: "Sage mist", hex: "#9aa59b", bg: "bg-[#9aa59b]" },
]

export default function BrandPage() {
  const categories = ["Logo", "Color", "Typography", "Photography"] as const
  return (
    <>
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_50%_30%,#d9f45b,transparent_55%)]" />
        <div className="container-x relative pt-32 pb-16 lg:pt-44">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Brand</p>
          <h1 className="mt-6 text-5xl font-medium leading-[0.98] tracking-[-0.05em] sm:text-7xl">
            PropDesk Africa brand kit.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-primary-foreground/70">
            Logos, color tokens, typography and photography. Free to use in editorial and partner
            contexts — please don't modify the marks.
          </p>
        </div>
      </section>

      <section className="bg-background py-16 lg:py-20">
        <div className="container-x">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Colors</p>
          <h2 className="mt-3 text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-4xl">
            Six core tokens.
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {colors.map((c) => (
              <div key={c.hex} className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className={`aspect-[16/9] ${c.bg}`} />
                <div className="p-5">
                  <p className="text-base font-medium">{c.name}</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{c.hex}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {categories.map((cat) => {
        const items = brandAssets.filter((a) => a.category === cat)
        if (items.length === 0) return null
        return (
          <section key={cat} className="bg-secondary/40 py-16 first-of-type:pt-12 lg:py-20">
            <div className="container-x">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{cat}</p>
              <h2 className="mt-3 text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-4xl">
                {cat === "Logo" && "Marks & wordmark"}
                {cat === "Color" && "Design tokens"}
                {cat === "Typography" && "Guidelines"}
                {cat === "Photography" && "Product & team photography"}
              </h2>
              <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((a) => (
                  <li
                    key={a.slug}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5"
                  >
                    <div>
                      <p className="text-sm font-medium">{a.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{a.description}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{a.format} · {a.size}</p>
                    </div>
                    <button
                      type="button"
                      className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-primary hover:bg-primary hover:text-primary-foreground"
                      aria-label={`Download ${a.name}`}
                    >
                      <Download className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )
      })}

      <section className="bg-background py-20">
        <div className="container-x max-w-3xl text-center">
          <h2 className="text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-4xl">
            Press, partnerships, integrations?
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Email{" "}
            <Link href="mailto:bknglabs.dev@gmail.com" className="font-medium text-primary underline">
              bknglabs.dev@gmail.com
            </Link>{" "}
            and we'll get back within a day.
          </p>
        </div>
      </section>
    </>
  )
}
