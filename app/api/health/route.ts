import { NextResponse } from "next/server"
import { isSupabaseConfigured } from "@/lib/supabase/server"
import { neonConfigured, pingDb } from "@/lib/db/neon"

export const dynamic = "force-dynamic"

/**
 * GET /api/health — quick liveness probe. Reports the runtime state of
 * every external service the app depends on (Supabase Auth, Neon DB,
 * M-Pesa config, and the secrets that gate privileged endpoints).
 */
export async function GET() {
  const t0 = Date.now()
  const db = await pingDb().catch((e) => ({ ok: false as const, error: e?.message || String(e) }))

  /**
   * These gate /api/migrations/*, /api/backup/auto and /api/cron/run. Each
   * one fails CLOSED in production, but an unset secret still means the
   * endpoint 503s rather than working — so surface it here where a deploy
   * check will actually look, instead of letting someone discover it the
   * first time a backup silently stops running.
   */
  const requiredSecrets = {
    CRON_SECRET: process.env.CRON_SECRET,
    MIGRATION_SECRET: process.env.MIGRATION_SECRET,
    BACKUP_CRON_SECRET: process.env.BACKUP_CRON_SECRET,
  } as const
  const missingSecrets = Object.entries(requiredSecrets)
    .filter(([, v]) => !v)
    .map(([k]) => k)

  return NextResponse.json({
    status: "ok",
    time: new Date().toISOString(),
    supabase: isSupabaseConfigured ? "configured" : "missing-env",
    database: db.ok
      ? { backend: "neon", ok: true, ms: db.ms }
      : { backend: "neon", ok: false, error: db.error },
    mpesa: process.env.MPESA_CONSUMER_KEY ? "configured" : process.env.MPESA_SANDBOX_MOCK === "1" ? "mock" : "missing-env",
    cron: process.env.CRON_SECRET ? "secret-set" : "open",
    secrets: {
      required: Object.keys(requiredSecrets),
      missing: missingSecrets,
      ok: missingSecrets.length === 0,
    },
    total_ms: Date.now() - t0,
  })
}
