import { NextResponse } from "next/server"
import { solutions } from "@/lib/content/marketing"

export const runtime = "nodejs"

export async function GET() {
  return NextResponse.json({
    count: solutions.length,
    solutions: solutions.map((s) => ({ slug: s.slug, name: s.name, tagline: s.tagline, audience: s.audience })),
  })
}