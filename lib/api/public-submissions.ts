/**
 * Persistence helper for PUBLIC write endpoints.
 *
 * The marketing forms (newsletter, contact, lead capture, feedback, support,
 * customer-request votes) used to `console.log` the submission and return a
 * convincing `ok: true`. Nothing was stored, so the visitor saw a success
 * message and the enquiry was gone. This module is the "actually store it"
 * half of the fix.
 *
 * Two rules shape the design:
 *
 * 1. NEVER LIE. If the database is not configured or the insert fails, the
 *    caller must surface a real error to the user. Returning a success
 *    response when nothing was written is the exact defect this replaces.
 *
 * 2. NEVER INTERPOLATE USER DATA INTO SQL. Table names and column names come
 *    from the hardcoded allowlists below and are validated before use; values
 *    are always bound parameters.
 *
 * Storage priority: Neon (the primary database) first, then the Supabase
 * Postgres fallback, matching lib/db/neon.ts and lib/backup.ts.
 */
import { neonConfigured, getDb } from "@/lib/db/neon"
import { createServiceClient } from "@/lib/supabase/service"

/**
 * Tables this module may write to, and the exact columns it may set.
 * Adding a table here is a deliberate act — it is the allowlist that keeps
 * attacker-controlled keys out of the SQL statement.
 */
export const PUBLIC_SUBMISSION_TABLES = {
  newsletter_subscribers: ["email", "source", "referrer", "user_agent", "created_at"],
  contact_submissions: [
    "first_name",
    "last_name",
    "email",
    "company",
    "topic",
    "message",
    "reference",
    "created_at",
  ],
  support_tickets: [
    "user_id",
    "reference",
    "subject",
    "category",
    "priority",
    "message",
    "status",
    "created_at",
  ],
  customer_requests: ["slug", "title", "body", "email", "reference", "votes", "created_at"],
  customer_request_votes: ["slug", "voter_hash", "created_at"],
} as const

export type PublicSubmissionTable = keyof typeof PUBLIC_SUBMISSION_TABLES

export class SubmissionStoreError extends Error {
  constructor(message: string, public readonly retryable = true) {
    super(message)
  }
}

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/

function assertSafeIdentifier(value: string, label: string): void {
  if (!IDENTIFIER.test(value)) {
    throw new SubmissionStoreError(`Unsafe ${label} rejected: ${value}`, false)
  }
}

export interface InsertResult {
  /** The generated row id, when the database returned one. */
  id: string | null
}

/**
 * Insert one row into an allowlisted table.
 *
 * @param table one of PUBLIC_SUBMISSION_TABLES
 * @param row   column/value pairs; unknown columns are rejected outright
 */
export async function insertSubmission(
  table: PublicSubmissionTable,
  row: Record<string, unknown>,
  options: { ignoreConflict?: boolean } = {},
): Promise<InsertResult> {
  const allowed = PUBLIC_SUBMISSION_TABLES[table] as readonly string[]
  assertSafeIdentifier(table, "table name")

  // Reject unknown columns instead of silently dropping them — a caller
  // passing an unexpected field is a bug, and silently ignoring it is how
  // data goes missing without anyone noticing.
  const entries = Object.entries(row).filter(([, v]) => v !== undefined && v !== null)
  for (const [column] of entries) {
    if (!allowed.includes(column)) {
      throw new SubmissionStoreError(`Unknown column "${column}" for table "${table}"`, false)
    }
    assertSafeIdentifier(column, "column name")
  }
  if (entries.length === 0) {
    throw new SubmissionStoreError("Refusing to insert an empty row", false)
  }

  const columns = entries.map(([k]) => k).join(", ")
  const placeholders = entries.map((_, i) => `$${i + 1}`).join(", ")
  const values = entries.map(([, v]) => v)

  if (neonConfigured()) {
    const sql = getDb()
    const conflict = options.ignoreConflict ? " on conflict do nothing" : ""
    const rows = (await (sql as any).unsafe(
      `insert into public.${table} (${columns}) values (${placeholders})${conflict} returning id`,
      values,
    )) as Array<{ id?: string }>
    return { id: rows?.[0]?.id ?? null }
  }

  // Supabase fallback — the service-role client bypasses RLS, which is what a
  // PUBLIC endpoint needs: the caller is anonymous, so the anon client would
  // be (correctly) refused. The service key is never sent to the browser.
  const supabase = createServiceClient()
  if (!supabase) {
    throw new SubmissionStoreError(
      "No database is configured for public submissions (DATABASE_URL and SUPABASE_SERVICE_ROLE_KEY are both missing).",
    )
  }
  const payload: Record<string, unknown> = {}
  for (const [k, v] of entries) payload[k] = v
  const query = options.ignoreConflict
    ? supabase.from(table).upsert(payload, { onConflict: "email", ignoreDuplicates: true }).select("id")
    : supabase.from(table).insert(payload).select("id")
  const { data, error } = await query.maybeSingle()
  if (error) {
    throw new SubmissionStoreError(`Failed to store submission: ${error.message}`)
  }
  return { id: (data as { id?: string } | null)?.id ?? null }
}

/**
 * Read a single row's numeric counter, used to return the REAL stored vote
 * count instead of a locally incremented number.
 */
export async function readCount(
  table: PublicSubmissionTable,
  where: Record<string, unknown>,
): Promise<number> {
  const allowed = PUBLIC_SUBMISSION_TABLES[table] as readonly string[]
  assertSafeIdentifier(table, "table name")

  const entries = Object.entries(where)
  for (const [column] of entries) {
    if (!allowed.includes(column)) {
      throw new SubmissionStoreError(`Unknown column "${column}" for table "${table}"`, false)
    }
    assertSafeIdentifier(column, "column name")
  }
  const clause = entries.map(([k], i) => `${k} = $${i + 1}`).join(" and ")

  if (neonConfigured()) {
    const sql = getDb()
    const rows = (await (sql as any).unsafe(
      `select count(*)::int as n from public.${table} where ${clause}`,
      entries.map(([, v]) => v),
    )) as Array<{ n?: number }>
    return rows?.[0]?.n ?? 0
  }

  const supabase = createServiceClient()
  if (!supabase) {
    throw new SubmissionStoreError(
      "No database is configured to read submission counts (DATABASE_URL and SUPABASE_SERVICE_ROLE_KEY are both missing).",
    )
  }
  let query = supabase.from(table).select("*", { count: "exact", head: true })
  for (const [k, v] of entries) query = query.eq(k, v as string)
  const { count, error } = await query
  if (error) throw new SubmissionStoreError(`Failed to read count: ${error.message}`)
  return count ?? 0
}

/**
 * List rows from an allowlisted table, newest first.
 * Used to surface community-submitted ideas on the public roadmap.
 */
export async function listSubmissions(
  table: PublicSubmissionTable,
  options: { limit?: number } = {},
): Promise<Array<Record<string, unknown>>> {
  const allowed = PUBLIC_SUBMISSION_TABLES[table] as readonly string[]
  assertSafeIdentifier(table, "table name")
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 500)

  if (neonConfigured()) {
    const sql = getDb()
    const rows = (await (sql as any).unsafe(
      `select * from public.${table} order by created_at desc limit $1`,
      [limit],
    )) as Array<Record<string, unknown>>
    return rows ?? []
  }

  const supabase = createServiceClient()
  if (!supabase) {
    throw new SubmissionStoreError(
      "No database is configured to list submissions (DATABASE_URL and SUPABASE_SERVICE_ROLE_KEY are both missing).",
    )
  }
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw new SubmissionStoreError(`Failed to list submissions: ${error.message}`)
  return (data ?? []) as Array<Record<string, unknown>>
}

/**
 * A stable, non-reversible identifier for an anonymous voter, used to enforce
 * one vote per device without storing an IP address or a fingerprint.
 */
export async function voterHash(seed: string): Promise<string> {
  const { createHash, randomBytes } = await import("node:crypto")
  const salt = process.env.RATE_LIMIT_SALT ?? randomBytes(16).toString("hex")
  return createHash("sha256").update(`${salt}:${seed}`).digest("hex")
}

/**
 * A short, human-quotable reference for a stored submission.
 * Not a security token — it only has to be unique enough to find a row.
 */
export function reference(prefix: string): string {
  const stamp = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${prefix}-${stamp}-${rand}`
}
