/**
 * Inline SVG illustrations for empty states and marketing surfaces.
 *
 * Each illustration is self-contained, uses currentColor where it makes
 * sense, and can be sized via the `className` prop. The goal is to
 * give the app a consistent visual language without external assets.
 */
import type { CSSProperties } from "react"

interface Props {
  className?: string
  style?: CSSProperties
  title?: string
}

export function IllustrationEmptyBuilding({ className, style, title = "No properties" }: Props) {
  return (
    <svg
      viewBox="0 0 200 140"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      role="img"
      aria-label={title}
    >
      <defs>
        <linearGradient id="eb-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary) / 0.08)" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="200" height="140" fill="url(#eb-sky)" />
      {/* ground */}
      <rect x="0" y="118" width="200" height="22" fill="hsl(var(--muted))" />
      {/* building 1 (small) */}
      <rect x="32" y="60" width="36" height="58" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1.5" />
      <rect x="40" y="68" width="8" height="10" fill="hsl(var(--primary) / 0.35)" />
      <rect x="52" y="68" width="8" height="10" fill="hsl(var(--primary) / 0.35)" />
      <rect x="40" y="82" width="8" height="10" fill="hsl(var(--primary) / 0.35)" />
      <rect x="52" y="82" width="8" height="10" fill="hsl(var(--primary) / 0.35)" />
      <rect x="40" y="96" width="8" height="10" fill="hsl(var(--primary) / 0.35)" />
      <rect x="52" y="96" width="8" height="10" fill="hsl(var(--primary) / 0.35)" />
      {/* building 2 (tall) */}
      <rect x="78" y="36" width="44" height="82" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1.5" />
      <rect x="86" y="46" width="10" height="12" fill="hsl(var(--accent) / 0.5)" />
      <rect x="104" y="46" width="10" height="12" fill="hsl(var(--accent) / 0.5)" />
      <rect x="86" y="62" width="10" height="12" fill="hsl(var(--accent) / 0.5)" />
      <rect x="104" y="62" width="10" height="12" fill="hsl(var(--accent) / 0.5)" />
      <rect x="86" y="78" width="10" height="12" fill="hsl(var(--accent) / 0.5)" />
      <rect x="104" y="78" width="10" height="12" fill="hsl(var(--accent) / 0.5)" />
      <rect x="86" y="94" width="10" height="12" fill="hsl(var(--accent) / 0.5)" />
      <rect x="104" y="94" width="10" height="12" fill="hsl(var(--accent) / 0.5)" />
      {/* building 3 (medium) */}
      <rect x="132" y="56" width="36" height="62" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1.5" />
      <rect x="140" y="64" width="8" height="10" fill="hsl(var(--secondary) / 0.45)" />
      <rect x="152" y="64" width="8" height="10" fill="hsl(var(--secondary) / 0.45)" />
      <rect x="140" y="78" width="8" height="10" fill="hsl(var(--secondary) / 0.45)" />
      <rect x="152" y="78" width="8" height="10" fill="hsl(var(--secondary) / 0.45)" />
      <rect x="140" y="92" width="8" height="10" fill="hsl(var(--secondary) / 0.45)" />
      <rect x="152" y="92" width="8" height="10" fill="hsl(var(--secondary) / 0.45)" />
      {/* sun */}
      <circle cx="170" cy="22" r="10" fill="hsl(var(--chart-4) / 0.85)" />
    </svg>
  )
}

export function IllustrationEmptyInbox({ className, style, title = "Nothing here" }: Props) {
  return (
    <svg
      viewBox="0 0 200 140"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      role="img"
      aria-label={title}
    >
      <rect x="0" y="0" width="200" height="140" fill="hsl(var(--primary) / 0.04)" />
      <rect x="36" y="44" width="128" height="80" rx="8" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1.5" />
      <path d="M36 60 L70 80 L100 60 L130 80 L164 60" stroke="hsl(var(--primary))" strokeWidth="2" fill="none" strokeLinejoin="round" />
      <path d="M36 60 L36 124 L164 124 L164 60" stroke="hsl(var(--border))" strokeWidth="1.5" fill="none" />
      {/* floating bubble */}
      <circle cx="160" cy="30" r="10" fill="hsl(var(--accent) / 0.4)" />
    </svg>
  )
}

export function IllustrationEmptyWallet({ className, style, title = "No transactions" }: Props) {
  return (
    <svg
      viewBox="0 0 200 140"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      role="img"
      aria-label={title}
    >
      <rect x="0" y="0" width="200" height="140" fill="hsl(var(--primary) / 0.04)" />
      <rect x="40" y="48" width="120" height="68" rx="8" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1.5" />
      <rect x="40" y="48" width="40" height="14" fill="hsl(var(--primary))" rx="4" />
      <rect x="60" y="92" width="80" height="6" rx="3" fill="hsl(var(--muted))" />
      <rect x="60" y="104" width="56" height="6" rx="3" fill="hsl(var(--muted))" />
      <circle cx="140" cy="98" r="8" fill="hsl(var(--accent) / 0.7)" />
    </svg>
  )
}

export function IllustrationEmptyWrench({ className, style, title = "No maintenance" }: Props) {
  return (
    <svg
      viewBox="0 0 200 140"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      role="img"
      aria-label={title}
    >
      <rect x="0" y="0" width="200" height="140" fill="hsl(var(--primary) / 0.04)" />
      {/* wrench */}
      <path
        d="M58 96 L100 54 M120 44 a14 14 0 1 0 -14 -14 L96 40 L106 50 L100 56 L90 46 L80 56 L96 72 L70 96 a8 8 0 1 0 12 12 Z"
        fill="hsl(var(--primary))"
      />
    </svg>
  )
}

export function IllustrationEmptyFile({ className, style, title = "No documents" }: Props) {
  return (
    <svg
      viewBox="0 0 200 140"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      role="img"
      aria-label={title}
    >
      <rect x="0" y="0" width="200" height="140" fill="hsl(var(--primary) / 0.04)" />
      <path d="M60 30 L120 30 L150 60 L150 110 L60 110 Z" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1.5" />
      <path d="M120 30 L120 60 L150 60" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="1.5" />
      <rect x="74" y="74" width="62" height="5" rx="2.5" fill="hsl(var(--muted))" />
      <rect x="74" y="86" width="48" height="5" rx="2.5" fill="hsl(var(--muted))" />
    </svg>
  )
}

export function IllustrationUsers({ className, style, title = "No tenants" }: Props) {
  return (
    <svg
      viewBox="0 0 200 140"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      role="img"
      aria-label={title}
    >
      <rect x="0" y="0" width="200" height="140" fill="hsl(var(--primary) / 0.04)" />
      <circle cx="80" cy="58" r="18" fill="hsl(var(--primary) / 0.3)" />
      <path d="M52 110 a28 28 0 0 1 56 0 Z" fill="hsl(var(--primary) / 0.4)" />
      <circle cx="124" cy="62" r="14" fill="hsl(var(--accent) / 0.4)" />
      <path d="M104 110 a20 20 0 0 1 40 0 Z" fill="hsl(var(--accent) / 0.4)" />
    </svg>
  )
}

export function IllustrationSearch({ className, style, title = "No results" }: Props) {
  return (
    <svg
      viewBox="0 0 200 140"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      role="img"
      aria-label={title}
    >
      <rect x="0" y="0" width="200" height="140" fill="hsl(var(--primary) / 0.04)" />
      <circle cx="86" cy="66" r="34" fill="none" stroke="hsl(var(--primary))" strokeWidth="6" />
      <line x1="112" y1="92" x2="146" y2="124" stroke="hsl(var(--primary))" strokeWidth="6" strokeLinecap="round" />
    </svg>
  )
}
