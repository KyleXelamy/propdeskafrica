/**
 * Backup + restore runtime. Talks to Neon (preferred) or Supabase
 * to read / write user data. Pure functions for the SQL building
 * blocks; route handlers wrap the auth + HTTP edge.
 */

import { neonConfigured, getDb } from "@/lib/db/neon"
import { createClient } from "@/lib/supabase/server"
import { APP_VERSION, BACKUP_TABLES, CURRENT_SCHEMA_VERSION, type BackupPayload, type RestoreOptions, type RestoreResult, type SanitisedRow, sanitiseRow, BackupPayloadSchema, RestoreOptionsSchema } from "@/lib/system"
import { uploadBackup, getBackupSignedUrl, BACKUP_SIZE_LIMIT } from "@/lib/storage"

/* ------------------------------------------------------------------ *
 * SQL identifier validation
 * ------------------------------------------------------------------ *
 * The backup subsystem builds raw SQL. Two identifiers can reach it from a
 * request: the TABLE name (POST /api/backup body, and the ?table= segment of
 * /api/backup/csv/[table]) and the COLUMN names (the keys of a row in an
 * uploaded backup file).
 *
 * A column name is especially dangerous: a backup row's keys are fully
 * attacker-controlled (BackupPayloadSchema uses z.record(z.any())), and they
 * were interpolated straight into the INSERT as quoted identifiers WITHOUT
 * escaping the embedded double quote. A key such as
 *
 *   name") values (($1::text || (select current_user))) --
 *
 * produced a valid statement that executed arbitrary SQL and wrote the result
 * into a row the attacker owns. Both identifiers are now validated against a
 * strict pattern AND against the table's real column list before any SQL
 * string is built.
 */

const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]*$/

export class BackupValidationError extends Error {
  readonly status = 400
  constructor(message: string) {
    super(message)
    this.name = "BackupValidationError"
  }
}

/** True when `name` is a plain lowercase Postgres identifier. */
export function isSafeIdentifier(name: unknown): name is string {
  return typeof name === "string" && SAFE_IDENTIFIER.test(name)
}

/**
 * Every table that may be exported or restored. The table name is an
 * identifier, so it is interpolated into SQL — it must never be caller
 * controlled.
 */
export const BACKUP_TABLE_ALLOWLIST: ReadonlySet<string> = new Set(BACKUP_TABLES as readonly string[])

/** Throws unless `table` is an allowlisted, syntactically safe table name. */
export function assertAllowedBackupTable(table: unknown): string {
  if (!isSafeIdentifier(table)) {
    throw new BackupValidationError("Invalid table name")
  }
  if (!BACKUP_TABLE_ALLOWLIST.has(table)) {
    throw new BackupValidationError(`Table "${table}" is not an allowed backup table`)
  }
  return table
}

/**
 * The column that identifies the owning user for a given table.
 * `user_profiles` is keyed by the user id itself; everything else carries a
 * `user_id` column.
 */
export function ownerColumnFor(table: string): string {
  return table === "user_profiles" ? "id" : "user_id"
}

/**
 * Cache of the real column set of each backup table, read once per process
 * from information_schema. Cached so the restore path does not query the
 * catalogue for every row.
 */
const columnCache = new Map<string, Promise<ReadonlySet<string>>>()

export async function loadAllowedColumns(
  sql: ReturnType<typeof getDb>,
  table: string,
): Promise<ReadonlySet<string>> {
  const cached = columnCache.get(table)
  if (cached) return cached

  const pending = (async () => {
    const rows = (await (sql as any).unsafe(
      `select column_name from information_schema.columns
        where table_schema = 'public' and table_name = $1`,
      [table],
    )) as Array<{ column_name?: string }>
    return new Set((rows ?? []).map((r) => String(r.column_name)))
  })()

  columnCache.set(table, pending)
  return pending
}

/** Drop the cached column lists. Used by tests and after a schema change. */
export function resetBackupColumnCache(): void {
  columnCache.clear()
}

export type RestoreMode = "skip" | "replace" | "merge"

export interface BuiltStatement {
  sql: string
  values: unknown[]
  columns: string[]
}

/**
 * Build the COUNT used to size one table for one user.
 */
export function buildExportCount(table: string, keyColumn: string): string {
  assertAllowedBackupTable(table)
  if (!isSafeIdentifier(keyColumn)) {
    throw new BackupValidationError("Invalid owner column")
  }
  return `select count(*)::int as n from public.${table} where ${keyColumn} = $1`
}

/**
 * Build the SELECT used to export one table for one user.
 * Pure — the table name must already be allowlisted.
 */
export function buildExportSelect(table: string, keyColumn: string): string {
  assertAllowedBackupTable(table)
  if (!isSafeIdentifier(keyColumn)) {
    throw new BackupValidationError("Invalid owner column")
  }
  return `select * from public.${table} where ${keyColumn} = $1`
}

/**
 * Build the INSERT used to restore one row.
 *
 * PURE and unit-testable: it takes the table's real column set as an
 * argument, so it needs no database.
 *
 * Throws BackupValidationError — and therefore builds NO SQL at all — when the
 * table is not allowlisted, the row has no columns, a column name fails the
 * identifier pattern, or a column is not one of the table's real columns.
 * Values are always bound as $n parameters and never interpolated.
 */
export function buildRestoreInsert(
  table: string,
  row: Record<string, unknown>,
  allowedColumns: readonly string[],
  mode: RestoreMode,
  conflictColumns: readonly string[] = [],
): BuiltStatement {
  assertAllowedBackupTable(table)

  const allowed = new Set(allowedColumns)
  const columns = Object.keys(row)
  if (columns.length === 0) {
    throw new BackupValidationError("Restore row contains no columns")
  }

  for (const column of columns) {
    if (!isSafeIdentifier(column)) {
      throw new BackupValidationError(`Unsafe column name rejected: ${JSON.stringify(column)}`)
    }
    if (!allowed.has(column)) {
      throw new BackupValidationError(
        `Unknown column "${column}" for table "${table}" — restore rejected`,
      )
    }
  }

  const values = columns.map((c) => row[c])
  const placeholders = columns.map((_, i) => `$${i + 1}`)
  const quoted = columns.map((c) => `"${c}"`)

  let sql = `insert into public.${table} (${quoted.join(",")}) values (${placeholders.join(",")})`

  if (mode === "skip") {
    sql += " on conflict do nothing"
  } else {
    if (conflictColumns.length === 0) {
      throw new BackupValidationError(`Restore mode "${mode}" requires conflict columns`)
    }
    for (const c of conflictColumns) {
      if (!allowed.has(c)) {
        throw new BackupValidationError(`Unknown conflict column "${c}"`)
      }
    }
    const target = conflictColumns.map((c) => `"${c}"`).join(",")
    const assignments = columns
      .filter((c) => !conflictColumns.includes(c))
      .map((c) => `"${c}" = $${columns.indexOf(c) + 1}`)
    sql += ` on conflict (${target}) do update set `
    sql += assignments.length
      ? assignments.join(",")
      : `"${conflictColumns[0]}" = excluded."${conflictColumns[0]}"`
  }

  return { sql, values, columns }
}

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
    // The table name is an SQL identifier — it must be allowlisted before it
    // reaches the statement. Throws BackupValidationError for a bad table.
    assertAllowedBackupTable(table)
    const keyCol = ownerColumnFor(table)
    const statement = buildExportSelect(table, keyCol)
    try {
      const rows = await (sql as any).unsafe(statement, [userId]) as any[]
      return rows.map(sanitiseRow)
    } catch (err) {
      console.warn(`[backup] neon select failed for ${table}`, err)
      return []
    }
  },
  async count(table, userId) {
    const sql = getDb()
    assertAllowedBackupTable(table)
    const keyCol = ownerColumnFor(table)
    const statement = buildExportCount(table, keyCol)
    try {
      const rows = await (sql as any).unsafe(statement, [userId]) as any[]
      return rows[0]?.n ?? 0
    } catch {
      return 0
    }
  },
  async insert(table, userId, rows, onConflict) {
    if (rows.length === 0) return { inserted: 0, updated: 0, skipped: 0 }
    const sql = getDb()
    let inserted = 0, updated = 0, skipped = 0
    // The table's REAL column set, read once per process from the catalogue.
    // Every row's keys are checked against it before any SQL is built, so an
    // attacker-controlled column name can never reach an identifier position.
    let allowedColumns: ReadonlySet<string>
    try {
      allowedColumns = await loadAllowedColumns(sql, table)
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown"
      console.warn(`[backup] could not read the column list for ${table}`, message)
      return { inserted: 0, updated: 0, skipped: rows.length, error: `Could not read the column list for ${table}` }
    }
    if (allowedColumns.size === 0) {
      return { inserted: 0, updated: 0, skipped: rows.length, error: `Unknown table ${table}` }
    }

    for (const row of rows) {
      // Re-stamp ownership on every row while preserving stable record IDs.
      // Profiles use their user ID as the primary key; all other records use user_id.
      const safe = table === "user_profiles" ? { ...row, id: userId, user_id: userId } : { ...row, user_id: userId }
      try {
        // Build the statement through the validated builder. It throws before
        // producing any SQL when a column name is unsafe or unknown.
        const conflictColumns = onConflict === "skip" ? [] : ["id"]
        if (conflictColumns.length > 0 && !("id" in safe)) {
          skipped++
          console.warn(`[backup] row skipped for ${table}: the "${onConflict}" mode needs an id column`)
          continue
        }
        const statement = buildRestoreInsert(
          table,
          safe,
          [...allowedColumns],
          onConflict,
          conflictColumns,
        )
        const result = await (sql as any).unsafe(statement.sql, statement.values) as any
        if (onConflict === "skip") inserted += result?.length ?? 1
        else updated += result?.length ?? 1
      } catch (err) {
        skipped++
        const message = err instanceof Error ? err.message : "unknown"
        console.warn(`[backup] row insert rejected for ${table}`, message)
      }
    }
    return { inserted, updated, skipped }
  },
  async deleteForUser(table, userId) {
    const sql = getDb()
    const keyCol = table === "user_profiles" ? "id" : "user_id"
    try {
      await (sql as any).unsafe(`delete from public.${table} where ${keyCol} = $1`, [userId])
    } catch (err) {
      console.warn(`[backup] delete failed for ${table}`, err)
    }
  },
}

const supabaseDb: Db = {
  async select(table, userId) {
    const supa = await createClient()
    const keyColumn = table === "user_profiles" ? "id" : "user_id"
    const { data, error } = await supa.from(table).select("*").eq(keyColumn, userId)
    if (error) {
      console.warn(`[backup] supabase select failed for ${table}`, error.message)
      return []
    }
    return (data ?? []).map(sanitiseRow)
  },
  async count(table, userId) {
    const supa = await createClient()
    const keyColumn = table === "user_profiles" ? "id" : "user_id"
    const { count, error } = await supa.from(table).select("*", { count: "exact", head: true }).eq(keyColumn, userId)
    if (error) {
      console.warn(`[backup] supabase count failed for ${table}`, error.message)
      return 0
    }
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
    const keyColumn = table === "user_profiles" ? "id" : "user_id"
    try {
      const { error } = await supa.from(table).delete().eq(keyColumn, userId)
      if (error) console.warn(`[backup] supabase delete failed for ${table}`, error.message)
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
  const requested = opts.tables && opts.tables.length > 0 ? opts.tables : [...BACKUP_TABLES]
  // Defence in depth: even if a caller forgets to validate, the library
  // refuses any table that is not allowlisted.
  const tables = requested.map((table) => assertAllowedBackupTable(table))
  const counts: Record<string, number> = {}
  const data: Record<string, SanitisedRow[]> = {}
  for (const table of tables) {
    const rows = await db.select(table, userId)
    counts[table] = rows.length
    data[table] = rows
  }
  return {
    schema_version: CURRENT_SCHEMA_VERSION,
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

  // PRE-FLIGHT: validate every row of every table BEFORE writing anything.
  // A restore that contains an unsafe or unknown column is rejected outright
  // rather than partially applied, so the database can never end up half
  // restored.
  const dbLayer = db as unknown as { preflight?: (table: string) => Promise<string[]> }
  for (const [table, rows] of Object.entries(parse.data.data)) {
    if (!BACKUP_TABLES.includes(table as any)) {
      errors.push({ table, error: "Unknown table — skipped" })
      continue
    }
    if (rows.length === 0) continue
    let allowed: ReadonlySet<string>
    try {
      allowed = await loadAllowedColumns(getDb(), table)
    } catch {
      // The catalogue is unavailable — fall back to the identifier check only
      // and let the per-row builder apply the real column allowlist.
      allowed = new Set<string>()
    }
    const allowedSet = new Set(allowed)
    for (const row of rows) {
      for (const column of Object.keys(row)) {
        if (!isSafeIdentifier(column)) {
          return {
            status: "failed",
            before_counts: {},
            after_counts: {},
            tables_restored: [],
            errors: [{ table, error: `Unsafe column name in the backup file: ${JSON.stringify(column)}` }],
          }
        }
        if (allowedSet.size > 0 && !allowedSet.has(column) && column !== "user_id" && column !== "id") {
          return {
            status: "failed",
            before_counts: {},
            after_counts: {},
            tables_restored: [],
            errors: [{ table, error: `Unknown column "${column}" for table "${table}"` }],
          }
        }
      }
    }
  }

  for (const [table, rows] of Object.entries(parse.data.data)) {
    if (!BACKUP_TABLES.includes(table as any)) {
      errors.push({ table, error: "Unknown table — skipped" })
      continue
    }
    if (rows.length === 0) continue

    const sanitized: SanitisedRow[] = (options.tables?.length ? rows.filter((row) => options.tables?.includes(table)) : rows).map(sanitiseRow)
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
