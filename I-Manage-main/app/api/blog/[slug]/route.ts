import { NextResponse, type NextRequest } from "next/server"
import { getBlogPost, getRelatedPosts } from "@/lib/content/blog"

/**
 * GET /api/blog/[slug]
 * Public endpoint that returns a single blog post and a small list of
 * related posts based on tag overlap.
 */
export const runtime = "nodejs"

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params
  const post = getBlogPost(slug)
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 })
  }

  return NextResponse.json({
    post: {
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      category: post.category,
      publishedAt: post.publishedAt,
      readingMinutes: post.readingMinutes,
      author: { name: post.author.name, role: post.author.role, initials: post.author.initials },
      cover: post.cover,
      tags: post.tags,
      body: post.body,
    },
    related: getRelatedPosts(slug).map((r) => ({
      slug: r.slug,
      title: r.title,
      excerpt: r.excerpt,
      cover: r.cover,
      readingMinutes: r.readingMinutes,
      category: r.category,
    })),
  })
}