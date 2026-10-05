import type React from "react"
import { MarketingHeader, MarketingFooter } from "@/components/marketing-site"

/**
 * Layout for all pages inside the (marketing) route group.
 * The header / footer are intentionally only here, so every marketing
 * page can rely on them and never duplicate them inline.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <MarketingHeader />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  )
}