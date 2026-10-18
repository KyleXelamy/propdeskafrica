/**
 * PropDesk Africa brand mark.
 *
 * Inline SVG so it can be themed via currentColor and used at any size.
 * The mark combines a doorway, skyline, and check shape to represent
 * property operations that stay clear and in control.
 */
import Image from "next/image"
import Link from "next/link"

interface MarkProps {
  size?: number
  className?: string
}

export function BrandMark({ size = 32, className }: MarkProps) {
  return (
    <span
      className={`inline-flex shrink-0 overflow-hidden rounded-[28%] bg-transparent ${className || ""}`}
      style={{ width: size, height: size }}
    >
      <Image
        src="/propdesk-africa-logo.png"
        alt="PropDesk Africa"
        width={size}
        height={size}
        className="h-full w-full scale-[1.42] object-cover"
        priority
      />
    </span>
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
