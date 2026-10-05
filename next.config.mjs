/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Cut down barrel imports from lucide-react so the bundler doesn't
  // try to tree-shake from the (marketing) entry on every build.
  experimental: {
    optimizePackageImports: ["lucide-react", "@radix-ui/react-icons", "date-fns", "lodash"],
  },
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  env: {
    APP_COMMIT: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev",
  },
}

export default nextConfig
