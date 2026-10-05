import { NextResponse } from "next/server"
import { roadmap } from "@/lib/content/marketing"

export const runtime = "nodejs"

export async function GET() {
  return NextResponse.json({
    count: roadmap.length,
    now: roadmap.filter((r) => r.status === "Now"),
    next: roadmap.filter((r) => r.status === "Next"),
    later: roadmap.filter((r) => r.status === "Later"),
    shipped: roadmap.filter((r) => r.status === "Shipped"),
  })
}