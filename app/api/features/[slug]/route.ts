import { NextResponse, type NextRequest } from "next/server"
import { features } from "@/lib/content/marketing"

export const runtime = "nodejs"

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params
  const f = features.find((x) => x.slug === slug)
  if (!f) return NextResponse.json({ error: "Feature not found" }, { status: 404 })
  return NextResponse.json({ feature: f })
}