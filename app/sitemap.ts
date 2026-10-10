import type { MetadataRoute } from "next"
import { blogPosts } from "@/lib/content/blog"

const SITE = "https://propdeskafrica.com"

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const staticRoutes = [
    "/",
    "/about",
    "/pricing",
    "/features",
    "/solutions",
    "/docs",
    "/contact",
    "/app",
    "/resources",
    "/careers",
    "/customers",
    "/press",
    "/changelog",
    "/status",
    "/security",
    "/help",
    "/integrations",
    "/auth/login",
    "/auth/sign-up",
    "/legal/privacy",
    "/legal/terms",
    "/legal/dpa",
  ]

  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((path) => ({
    url: `${SITE}${path}`,
    lastModified: now,
    changeFrequency: path === "/" || path === "/changelog" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : path === "/pricing" || path === "/resources" ? 0.9 : 0.7,
  }))

  const blogEntries: MetadataRoute.Sitemap = blogPosts.map((p) => ({
    url: `${SITE}/resources/${p.slug}`,
    lastModified: new Date(p.publishedAt),
    changeFrequency: "monthly",
    priority: 0.6,
  }))

  return [...staticEntries, ...blogEntries]
}
