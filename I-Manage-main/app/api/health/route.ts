import { NextResponse } from "next/server"
import { isSupabaseConfigured } from "@/lib/supabase/server"
import { neonConfigured, pingDb } from "@/lib/db/neon"

export const dynamic = "force-dynamic"

/**
 * GET /api/health — quick liveness probe. Reports the runtime state of
 * every external service the app depends on (Supabase Auth, Neon DB,
 * M-Pesa config, cron secret).
 */
export async function GET() {
  const t0 = Date.now()
  const db = await pingDb().catch((e) => ({ ok: false as const, error: e?.message || String(e) }))
  return NextResponse.json({
    status: "ok",
    time: new Date().toISOString(),
    supabase: isSupabaseConfigured ? "configured" : "missing-env",
    database: db.ok
      ? { backend: "neon", ok: true, ms: db.ms }
      : { backend: "neon", ok: false, error: db.error },
    mpesa: process.env.MPESA_CONSUMER_KEY ? "configured" : process.env.MPESA_SANDBOX_MOCK === "1" ? "mock" : "missing-env",
    cron: process.env.CRON_SECRET ? "secret-set" : "open",
    total_ms: Date.now() - t0,
  })
}
