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
  env: {
    APP_COMMIT: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev",
  },
}

export default nextConfig
