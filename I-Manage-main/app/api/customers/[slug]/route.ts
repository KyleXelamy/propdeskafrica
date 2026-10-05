import { NextResponse, type NextRequest } from "next/server"
import { customers } from "@/lib/content/marketing"

export const runtime = "nodejs"

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params
  const c = customers.find((x) => x.slug === slug)
  if (!c) return NextResponse.json({ error: "Customer not found" }, { status: 404 })
  return NextResponse.json({ customer: c })
}