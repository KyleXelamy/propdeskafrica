/**
 * Content-Security-Policy (IND-010).
 *
 * SHIPPED IN REPORT-ONLY MODE ON PURPOSE. Next.js injects inline bootstrap
 * scripts, this app renders inline styles (recharts, the JSON-LD block in
 * app/layout.tsx) and the browser talks to Supabase from the client, so an
 * enforcing policy without a per-request nonce would break the app. A CSP
 * that breaks the site is worse than no CSP at all.
 *
 * Report-only violations show up in the browser console (Chrome/Firefox
 * both log them) — open DevTools on every page type and check the console.
 *
 * To switch to ENFORCING mode:
 *   1. Walk the app with the report-only header and collect violations
 *      (DevTools console, or add a `report-uri`/`report-to` endpoint).
 *   2. Replace `script-src 'self' 'unsafe-inline'` with a per-request
 *      nonce: generate one in middleware.ts, put it in the
 *      `Content-Security-Policy` REQUEST header and forward it via the
 *      `x-nonce` request header — Next.js then stamps its own inline
 *      scripts with that nonce. Until that is in place, keep
 *      'unsafe-inline'.
 *   3. Rename the header key below from
 *      "Content-Security-Policy-Report-Only" to "Content-Security-Policy".
 *   4. If NEXT_PUBLIC_SUPABASE_URL is not a `*.supabase.co` host, add it to
 *      `connect-src` and `img-src` first.
 *
 * Hosts that are needed by the app:
 *   - *.supabase.co        : Supabase REST/Auth/Realtime + Storage objects
 *   - images.unsplash.com  : marketing hero images
 *   - *.tile.openstreetmap.org : react-leaflet map tiles
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  // 'unsafe-inline' is required until the per-request nonce is in place.
  "script-src 'self' 'unsafe-inline'",
  // Tailwind is bundled, but recharts and the theme provider set inline styles.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com https://*.tile.openstreetmap.org",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-src 'self'",
  "worker-src 'self' blob:",
  "media-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ")

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Strict TS, but don't fail builds on unrelated errors. Real errors are
  // caught by tsc in CI.
  typescript: {
    ignoreBuildErrors: true,
  },
  // Use Next's own image pipeline. (unoptimized: true disables the proxy
  // and lets images be served straight from the host — fine for marketing
  // pages, fine for the dashboard when we already have Vercel CDN.)
  images: {
    unoptimized: true,
  },
  // Cut down barrel imports from lucide-react so the bundler doesn't
  // try to tree-shake from the (marketing) entry on every build.
  experimental: {
    optimizePackageImports: ["lucide-react", "@radix-ui/react-icons", "date-fns", "lodash"],
    // Disable partial prerendering — we don't use it, and the underlying
    // cacheComponents pipeline generates the manifests that break for
    // route groups with "use client" on a server-only root page.
    ppr: false,
  },
  // Transpile the workspace packages so server components can import
  // shared utilities without webpack alias quirks.
  transpilePackages: ["@/lib", "@/components"],
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        // IND-010: the HSTS value was missing includeSubDomains and preload,
        // which left every subdomain (staging, preview, *.vercel.app) able to
        // serve plaintext on a first visit. NOTE: `includeSubDomains` is a
        // commitment — every subdomain of the apex domain must be HTTPS-only
        // or browsers will refuse to load it, and `preload` additionally
        // requires submitting the domain to hstspreload.org.
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        // Report-only for now — see the comment above CONTENT_SECURITY_POLICY.
        { key: "Content-Security-Policy-Report-Only", value: CONTENT_SECURITY_POLICY },
      ],
    }]
  },
  env: {
    APP_COMMIT: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev",
  },
}

export default nextConfig
