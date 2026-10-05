import { NextResponse } from "next/server"
import { features } from "@/lib/content/marketing"

export const runtime = "nodejs"

export async function GET() {
  return NextResponse.json({
    count: features.length,
    features: features.map(({ slug, name, tagline, summary, icon, bullets }) => ({
      slug, name, tagline, summary, icon, bullets,
    })),
  })
}