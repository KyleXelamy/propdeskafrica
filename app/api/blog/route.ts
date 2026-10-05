import { NextResponse, type NextRequest } from "next/server"
import { blogPosts } from "@/lib/content/blog"

/**
 * GET /api/blog
 * Public endpoint that returns a sanitised list of blog posts.
 * Supports ?category=Product&limit=10 for the resources filter UI.
 */
export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get("category")
  const limit = Math.min(Number(searchParams.get("limit") ?? 50) || 50, 100)

  let posts = blogPosts
  if (category && category.toLowerCase() !== "all") {
    posts = posts.filter(
      (p) => p.category.toLowerCase() === category.toLowerCase(),
    )
  }

  const sanitized = posts.slice(0, limit).map((p) => ({
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    category: p.category,
    publishedAt: p.publishedAt,
    readingMinutes: p.readingMinutes,
    author: { name: p.author.name, role: p.author.role, initials: p.author.initials },
    cover: p.cover,
    tags: p.tags,
  }))

  return NextResponse.json({ count: sanitized.length, posts: sanitized })
}