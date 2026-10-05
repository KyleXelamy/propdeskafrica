import type { MetadataRoute } from "next"
import { blogPosts } from "@/lib/content/blog"
import { features, solutions, docArticles, customers, insights } from "@/lib/content/marketing"

const SITE = "https://i-manage.app"

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const staticRoutes = [
    "/",
    "/about",
    "/features",
    "/pricing",
    "/contact",
    "/contact/sales",
    "/contact/support",
    "/app",
    "/resources",
    "/insights",
    "/customers",
    "/docs",
    "/developers",
    "/community",
    "/templates",
    "/roadmap",
    "/customer-requests",
    "/brand",
    "/compare",
    "/data",
    "/security",
    "/careers",
    "/press",
    "/changelog",
    "/status",
    "/help",
    "/integrations",
    "/sub-processors",
    "/auth/login",
    "/auth/sign-up",
    "/legal/privacy",
    "/legal/terms",
    "/legal/dpa",
    "/legal/cookies",
    "/legal/acceptable-use",
  ]

  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((path) => ({
    url: `${SITE}${path}`,
    lastModified: now,
    changeFrequency:
      path === "/" || path === "/changelog" || path === "/roadmap" || path === "/customer-requests"
        ? "weekly"
        : "monthly",
    priority:
      path === "/"
        ? 1
        : path === "/pricing" || path === "/features" || path === "/resources" || path === "/customers"
          ? 0.9
          : path === "/docs" || path === "/developers"
            ? 0.8
            : 0.6,
  }))

  const blogEntries: MetadataRoute.Sitemap = blogPosts.map((p) => ({
    url: `${SITE}/resources/${p.slug}`,
    lastModified: new Date(p.publishedAt),
    changeFrequency: "monthly",
    priority: 0.6,
  }))

  const featureEntries: MetadataRoute.Sitemap = features.map((f) => ({
    url: `${SITE}/features/${f.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  }))

  const solutionEntries: MetadataRoute.Sitemap = solutions.map((s) => ({
    url: `${SITE}/solutions/${s.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  }))

  const customerEntries: MetadataRoute.Sitemap = customers.map((c) => ({
    url: `${SITE}/customers/${c.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  }))

  const docEntries: MetadataRoute.Sitemap = docArticles.map((a) => ({
    url: `${SITE}/docs/${a.slug}`,
    lastModified: new Date(a.updated),
    changeFrequency: "monthly",
    priority: 0.5,
  }))

  const insightEntries: MetadataRoute.Sitemap = insights.map((i) => ({
    url: `${SITE}/insights/${i.slug}`,
    lastModified: new Date(i.publishedAt),
    changeFrequency: "monthly",
    priority: 0.6,
  }))

  return [
    ...staticEntries,
    ...blogEntries,
    ...featureEntries,
    ...solutionEntries,
    ...customerEntries,
    ...docEntries,
    ...insightEntries,
  ]
}