import { NextResponse, type NextRequest } from "next/server"
import { templates } from "@/lib/content/marketing"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get("category")
  let items = templates
  if (category) items = items.filter((t) => t.category.toLowerCase() === category.toLowerCase())
  return NextResponse.json({ count: items.length, templates: items })
}