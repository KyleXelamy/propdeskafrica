/**
 * Backup + restore runtime. Talks to Neon (preferred) or Supabase
 * to read / write user data. Pure functions for the SQL building
 * blocks; route handlers wrap the auth + HTTP edge.
 */

import { neonConfigured, getDb } from "@/lib/db/neon"
import { createClient } from "@/lib/supabase/server"
import { APP_NAME, APP_VERSION, BACKUP_TABLES, type BackupPayload, type RestoreOptions, type RestoreResult, type SanitisedRow, sanitiseRow, BackupPayloadSchema, RestoreOptionsSchema } from "@/lib/system"
import { uploadBackup, getBackupSignedUrl, BACKUP_SIZE_LIMIT } from "@/lib/storage"

type Db = {
  // Returns a flat array of objects for a table
  select: (table: string, userId: string) => Promise<SanitisedRow[]>
  // Returns number of rows in a table for a user
  count: (table: string, userId: string) => Promise<number>
  // Inserts rows. `onConflict` controls the strategy.
  insert: (table: string, userId: string, rows: SanitisedRow[], onConflict: "skip" | "replace" | "merge") => Promise<{ inserted: number; updated: number; skipped: number; error?: string }>
  // Wipes a table for a user (used by `restore --wipe-first`)
  deleteForUser: (table: string, userId: string) => Promise<void>
}

const neonDb: Db = {
  async select(table, userId) {
    const sql = getDb()
    // We rely on the user_id column existing on every table we back up.
    // Where it doesn't (e.g. user_profiles keyed by user_id as PK), we read
    // by id instead.
    const keyCol = table === "user_profiles" ? "id" : "user_id"
    try {
      const rows = await sql.unsafe(`select * from public.${table} where ${keyCol} = $1`, [userId]) as any[]
      return rows.map(sanitiseRow)
    } catch (err) {
      console.warn(`[backup] neon select failed for ${table}`, err)
      return []
    }
  },
  async count(table, userId) {
    const sql = getDb()
    const keyCol = table === "user_profiles" ? "id" : "user_id"
    try {
      const rows = await sql.unsafe(`select count(*)::int as n from public.${table} where ${keyCol} = $1`, [userId]) as any[]
      return rows[0]?.n ?? 0
    } catch {
      return 0
    }
  },
  async insert(table, userId, rows, onConflict) {
    if (rows.length === 0) return { inserted: 0, updated: 0, skipped: 0 }
    const sql = getDb()
    let inserted = 0, updated = 0, skipped = 0
    for (const row of rows) {
      // Re-stamp user_id on every row so we can never restore into
      // another user's workspace.
      const safe = { ...row, user_id: userId }
      try {
        if (onConflict === "skip") {
          const result = await sql.unsafe(
            `insert into public.${table} (${Object.keys(safe).map((k) => `"${k}"`).join(",")})
             values (${Object.keys(safe).map((_, i) => `$${i + 1}`).join(",")})
             on conflict do nothing`,
            Object.values(safe),
          ) as any
          inserted += result.length ?? 1
        } else if (onConflict === "replace") {
          const result = await sql.unsafe(
            `insert into public.${table} (${Object.keys(safe).map((k) => `"${k}"`).join(",")})
             values (${Object.keys(safe).map((_, i) => `$${i + 1}`).join(",")})
             on conflict (id) do update set ${Object.keys(safe)
               .filter((k) => k !== "id")
               .map((k) => `"${k}" = $${Object.keys(safe).indexOf(k) + 1}`)
               .join(", ")}`,
            Object.values(safe),
          ) as any
          updated += result.length ?? 1
        } else {
          // merge
          const result = await sql.unsafe(
            `insert into public.${table} (${Object.keys(safe).map((k) => `"${k}"`).join(",")})
             values (${Object.keys(safe).map((_, i) => `$${i + 1}`).join(",")})
             on conflict (id) do update set ${Object.keys(safe)
               .filter((k) => k !== "id")
               .map((k) => `"${k}" = excluded."${k}"`)
               .join(", ")}`,
            Object.values(safe),
          ) as any
          updated += result.length ?? 1
        }
      } catch (err) {
        skipped++
        const message = err instanceof Error ? err.message : "unknown"
        console.warn(`[backup] row insert failed for ${table}`, message)
      }
    }
    return { inserted, updated, skipped }
  },
  async deleteForUser(table, userId) {
    const sql = getDb()
    const keyCol = table === "user_profiles" ? "id" : "user_id"
    try {
      await sql.unsafe(`delete from public.${table} where ${keyCol} = $1`, [userId])
    } catch (err) {
      console.warn(`[backup] delete failed for ${table}`, err)
    }
  },
}

const supabaseDb: Db = {
  async select(table, userId) {
    const supa = await createClient()
    const { data } = await supa.from(table).select("*").eq("user_id", userId)
    return (data ?? []).map(sanitiseRow)
  },
  async count(table, userId) {
    const supa = await createClient()
    const { count } = await supa.from(table).select("*", { count: "exact", head: true }).eq("user_id", userId)
    return count ?? 0
  },
  async insert(table, userId, rows, onConflict) {
    if (rows.length === 0) return { inserted: 0, updated: 0, skipped: 0 }
    const supa = await createClient()
    let inserted = 0, updated = 0, skipped = 0
    for (const row of rows) {
      const safe = { ...row, user_id: userId }
      try {
        if (onConflict === "skip") {
          const { error } = await supa.from(table).insert(safe)
          if (error && error.code === "23505") skipped++
          else if (error) skipped++
          else inserted++
        } else if (onConflict === "replace") {
          const { error } = await supa.from(table).upsert(safe, { onConflict: "id" })
          if (error) skipped++
          else updated++
        } else {
          const { error } = await supa.from(table).upsert(safe, { onConflict: "id", ignoreDuplicates: false })
          if (error) skipped++
          else updated++
        }
      } catch {
        skipped++
      }
    }
    return { inserted, updated, skipped }
  },
  async deleteForUser(table, userId) {
    const supa = await createClient()
    try {
      await supa.from(table).delete().eq("user_id", userId)
    } catch (err) {
      console.warn(`[backup] supabase delete failed for ${table}`, err)
    }
  },
}

function getDbLayer(): Db {
  return neonConfigured() ? neonDb : supabaseDb
}

// ====================================================================
// Export
// ====================================================================

export interface ExportOptions {
  tables?: string[] // empty = all
  include_user?: boolean
}

export async function exportBackup(
  userId: string,
  userEmail: string | undefined,
  opts: ExportOptions = {},
): Promise<BackupPayload> {
  const db = getDbLayer()
  const tables = opts.tables && opts.tables.length > 0 ? opts.tables : [...BACKUP_TABLES]
  const counts: Record<string, number> = {}
  const data: Record<string, SanitisedRow[]> = {}
  for (const table of tables) {
    const rows = await db.select(table, userId)
    counts[table] = rows.length
    data[table] = rows
  }
  return {
    schema_version: 11,
    app_version: APP_VERSION,
    generated_at: new Date().toISOString(),
    user: { id: userId, email: userEmail },
    counts,
    data,
  }
}

// ====================================================================
// Restore
// ====================================================================

export async function restoreBackup(
  userId: string,
  payload: BackupPayload,
  rawOptions: Partial<RestoreOptions> = {},
): Promise<RestoreResult> {
  // Validate the payload
  const parse = BackupPayloadSchema.safeParse(payload)
  if (!parse.success) {
    return {
      status: "failed",
      before_counts: {},
      after_counts: {},
      tables_restored: [],
      errors: [{ table: "(payload)", error: "Invalid backup file" }],
    }
  }
  const options = RestoreOptionsSchema.parse(rawOptions)
  const db = getDbLayer()

  const beforeCounts: Record<string, number> = {}
  const afterCounts: Record<string, number> = {}
  const tablesRestored: string[] = []
  const errors: Array<{ table: string; error: string }> = []

  for (const [table, rows] of Object.entries(parse.data.data)) {
    if (!BACKUP_TABLES.includes(table as any)) {
      errors.push({ table, error: "Unknown table — skipped" })
      continue
    }
    if (rows.length === 0) continue

    const sanitized: SanitisedRow[] = rows.map(sanitiseRow)
    beforeCounts[table] = await db.count(table, userId)
    if (options.dry_run) {
      afterCounts[table] = beforeCounts[table] + sanitized.length
      tablesRestored.push(table)
      continue
    }
    const result = await db.insert(table, userId, sanitized, options.on_conflict)
    if (result.error) {
      errors.push({ table, error: result.error })
    } else {
      tablesRestored.push(table)
    }
    afterCounts[table] = await db.count(table, userId)
  }

  const status: RestoreResult["status"] =
    errors.length === 0 ? "success" : errors.length === tablesRestored.length ? "failed" : "partial"

  return { status, before_counts: beforeCounts, after_counts: afterCounts, tables_restored: tablesRestored, errors }
}

// ====================================================================
// Backup metadata persistence
// ====================================================================

export interface BackupRecord {
  id: string
  label: string
  kind: "full" | "properties" | "tenants" | "payments" | "expenses" | "maintenance" | "documents" | "contacts" | "damages" | "quotations"
  format: "json" | "csv-zip"
  size_bytes: number
  row_count: number
  storage_kind: "inline" | "storage"
  storage_path: string | null
  payload: BackupPayload | null
  metadata: Record<string, unknown>
  source: "manual" | "scheduled" | "pre-patch" | "pre-migration"
  created_at: string
}

export async function recordBackup(
  userId: string,
  record: Omit<BackupRecord, "id" | "created_at">,
): Promise<string> {
  const supa = await createClient()
  const { data, error } = await supa
    .from("backups")
    .insert({
      user_id: userId,
      label: record.label,
      kind: record.kind,
      format: record.format,
      size_bytes: record.size_bytes,
      row_count: record.row_count,
      storage_kind: record.storage_kind,
      storage_path: record.storage_path,
      payload: record.payload,
      metadata: record.metadata,
      source: record.source,
    })
    .select("id")
    .single()
  if (error) {
    console.warn("[backup] record insert failed", error.message)
    return crypto.randomUUID()
  }
  return data?.id ?? crypto.randomUUID()
}

export async function listBackups(userId: string): Promise<BackupRecord[]> {
  const supa = await createClient()
  const { data } = await supa
    .from("backups")
    .select("id, label, kind, format, size_bytes, row_count, storage_kind, storage_path, metadata, source, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50)
  return (data ?? []).map((r: any) => ({
    id: r.id,
    label: r.label,
    kind: r.kind,
    format: r.format,
    size_bytes: Number(r.size_bytes ?? 0),
    row_count: Number(r.row_count ?? 0),
    storage_kind: r.storage_kind,
    storage_path: r.storage_path,
    payload: null,
    metadata: r.metadata ?? {},
    source: r.source,
    created_at: r.created_at,
  }))
}

export async function getBackup(userId: string, id: string): Promise<BackupRecord | null> {
  const supa = await createClient()
  const { data } = await supa
    .from("backups")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle()
  if (!data) return null
  return {
    id: data.id,
    label: data.label,
    kind: data.kind,
    format: data.format,
    size_bytes: Number(data.size_bytes ?? 0),
    row_count: Number(data.row_count ?? 0),
    storage_kind: data.storage_kind,
    storage_path: data.storage_path,
    payload: data.payload ?? null,
    metadata: data.metadata ?? {},
    source: data.source,
    created_at: data.created_at,
  }
}

export async function deleteBackup(userId: string, id: string): Promise<boolean> {
  const supa = await createClient()
  const { error } = await supa.from("backups").delete().eq("user_id", userId).eq("id", id)
  return !error
}

export const __APP_NAME = APP_NAME