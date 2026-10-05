/**
 * I-Manage brand mark.
 *
 * Inline SVG so it can be themed via currentColor and used at any size.
 * Two variants:
 *   - "mark"   — just the I-in-square icon
 *   - "wordmark" — the full "I-Manage" word with a small "by Siemax Ltd"
 *     subtitle underneath. Use on the landing nav and the portal header.
 */
import Link from "next/link"

interface MarkProps {
  size?: number
  className?: string
}

export function BrandMark({ size = 32, className }: MarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="I-Manage"
    >
      <defs>
        <linearGradient id="im-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" />
          <stop offset="100%" stopColor="hsl(var(--accent))" />
        </linearGradient>
      </defs>
      <rect
        x="2"
        y="2"
        width="36"
        height="36"
        rx="8"
        fill="url(#im-grad)"
      />
      {/* A stylized "I" — vertical bar with rounded serifs */}
      <rect x="16" y="10" width="8" height="20" rx="2" fill="white" />
      <rect x="12" y="10" width="16" height="2.5" rx="1.25" fill="white" />
      <rect x="12" y="27.5" width="16" height="2.5" rx="1.25" fill="white" />
    </svg>
  )
}

interface WordmarkProps {
  href?: string
  showSubtitle?: boolean
  size?: "sm" | "md" | "lg"
  className?: string
}

export function BrandWordmark({ href, showSubtitle = true, size = "md", className }: WordmarkProps) {
  const markSize = size === "sm" ? 24 : size === "lg" ? 40 : 32
  const titleSize = size === "sm" ? "text-sm" : size === "lg" ? "text-2xl" : "text-base"
  const subSize = size === "sm" ? "text-[9px]" : size === "lg" ? "text-xs" : "text-[10px]"

  const inner = (
    <span className={`inline-flex items-center gap-2 ${className || ""}`}>
      <BrandMark size={markSize} />
      <span className="flex flex-col leading-tight">
        <span className={`${titleSize} font-bold tracking-tight`}>I-Manage</span>
        {showSubtitle && (
          <span className={`${subSize} uppercase tracking-[0.18em] text-muted-foreground`}>
            by Siemax Ltd
          </span>
        )}
      </span>
    </span>
  )

  if (href) {
    return <Link href={href} className="hover:opacity-80 transition-opacity">{inner}</Link>
  }
  return inner
}
