import { NextResponse, type NextRequest } from "next/server"
import { docArticles, docCategories } from "@/lib/content/marketing"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get("category")
  let items = docArticles
  if (category) items = items.filter((a) => a.category === category)
  return NextResponse.json({
    categories: docCategories,
    count: items.length,
    articles: items.map(({ slug, category, title, excerpt, readingMinutes, updated }) => ({
      slug, category, title, excerpt, readingMinutes, updated,
    })),
  })
}