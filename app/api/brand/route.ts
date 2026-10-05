import { NextResponse, type NextRequest } from "next/server"
import { brandAssets } from "@/lib/content/marketing"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get("category")
  let items = brandAssets
  if (category) items = items.filter((a) => a.category.toLowerCase() === category.toLowerCase())
  return NextResponse.json({ count: items.length, assets: items })
}