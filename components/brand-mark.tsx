/**
 * PropDesk Africa brand mark.
 *
 * Inline SVG so it can be themed via currentColor and used at any size.
 * The mark combines a doorway, skyline, and check shape to represent
 * property operations that stay clear and in control.
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
      aria-label="PropDesk Africa"
    >
      <defs>
        <linearGradient id="i-manage-mark-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" />
          <stop offset="100%" stopColor="hsl(var(--accent))" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="36" height="36" rx="11" fill="url(#i-manage-mark-gradient)" />
      <path d="M11 29V17l9-6 9 6v12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 29V21h8v8" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m13 15 3-2 3 2 3-2 3 2" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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
        <span className={`${titleSize} font-bold tracking-tight`}>PropDesk Africa</span>
        {showSubtitle && (
          <span className={`${subSize} uppercase tracking-[0.18em] text-muted-foreground`}>
            Property operations
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
