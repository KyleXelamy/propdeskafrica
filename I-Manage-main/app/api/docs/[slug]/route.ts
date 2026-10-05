import { NextResponse, type NextRequest } from "next/server"
import { docArticles } from "@/lib/content/marketing"

export const runtime = "nodejs"

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params
  const article = docArticles.find((a) => a.slug === slug)
  if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 })
  return NextResponse.json({ article })
}