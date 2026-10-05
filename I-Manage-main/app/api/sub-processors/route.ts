import { NextResponse } from "next/server"
import { subProcessors } from "@/lib/content/marketing"

export const runtime = "nodejs"

export async function GET() {
  return NextResponse.json({
    count: subProcessors.length,
    subProcessors,
    notice: "We notify customers at least 30 days before adding or replacing a sub-processor.",
  })
}