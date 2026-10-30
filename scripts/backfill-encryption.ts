/**
 * scripts/backfill-encryption.ts
 *
 * Backfills the PII columns that are still in plaintext with an encrypted
 * envelope (AES-256-GCM, `v1:<iv>:<tag>:<ciphertext>`).
 *
 * Run with:
 *   npx tsx scripts/backfill-encryption.ts --dry-run     # default: no writes
 *   npx tsx scripts/backfill-encryption.ts --apply        # writes
 *   npx tsx scripts/backfill-encryption.ts --apply --table=tenants
 *   npm run db:encrypt-backfill -- --dry-run
 *
 * PROPERTIES
 *   * DRY RUN BY DEFAULT. Nothing is written unless `--apply` (alias
 *     `--write`) is passed. `--dry-run` states the default explicitly.
 *   * IDEMPOTENT. A value that is already an envelope is skipped, so the
 *     script can be run as many times as you like — including after a partial
 *     run or after a key rotation.
 *   * SAFE WITH RESPECT TO PII. The script never prints a PII value. It
 *     prints counts, table names, column names and row ids only.
 *   * SAFE WITH RESPECT TO SQL. Every value is bound as a parameter through
 *     `sql.query(text, params)` — the bound-parameter style of the Neon HTTP
 *     driver (the same shape lib/backup.ts intends to use). Table and column
 *     names are interpolated, so they are validated against the plan
 *     (allowlist) and a strict identifier pattern before they reach the
 *     query.
 *   * FAILS CLOSED. A missing or malformed key is an error, not a silent
 *     no-op. The exit code is non-zero on any failure.
 *
 * NOTE ON THE DRIVER API
 *   `sql.unsafe(text, params)` is NOT a bound-parameter call in
 *   @neondatabase/serverless v1: `unsafe()` takes a single raw-SQL string and
 *   returns an interpolation marker (UnsafeRawSql) for use inside a tagged
 *   template. `sql.query(text, params)` is the API that takes numbered
 *   placeholders ($1, $2, …) and a parameter array. This script uses
 *   `sql.query()` for every statement. (lib/backup.ts:90,225,238,283,298 use
 *   `sql.unsafe(text, params)` — that call returns a marker object, not rows,
 *   and is a pre-existing defect in a file this change set does not touch.)
 *
 * The plan it walks is lib/crypto/pii-columns.ts (PII_COLUMNS) — the same
 * plan the application uses on the read and write paths.
 */

import { getDb, neonConfigured } from "@/lib/db/neon"
import {
  PII_COLUMNS,
  blindIndexColumnFor,
  normalizerFor,
  specsForTable,
  type PiiColumnSpec,
} from "@/lib/crypto/pii-columns"
import {
  encryptField,
  getKeyRegistry,
  isEncryptedField,
  blindIndex,
} from "@/lib/crypto/field-encryption"

/* -------------------------------------------------------------------------- */
/* Argument parsing                                                            */
/* -------------------------------------------------------------------------- */

interface Options {
  /** Write the changes. False = dry run (the default). */
  apply: boolean
  /** Restrict the run to one table. */
  table?: string
  /** Rows fetched per batch. */
  batchSize: number
}

const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]*$/
const ALLOWED_TABLES = new Set(PII_COLUMNS.map((spec) => spec.table))

function parseArgs(argv: string[]): Options {
  const options: Options = { apply: false, batchSize: 500 }
  for (const arg of argv) {
    if (arg === "--dry-run") {
      options.apply = false
    } else if (arg === "--apply" || arg === "--write") {
      options.apply = true
    } else if (arg.startsWith("--table=")) {
      options.table = arg.slice("--table=".length).trim()
    } else if (arg.startsWith("--batch-size=")) {
      const parsed = Number.parseInt(arg.slice("--batch-size=".length).trim(), 10)
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid --batch-size "${arg.slice("--batch-size=".length)}"`)
      }
      options.batchSize = parsed
    } else if (arg === "--help" || arg === "-h") {
      printUsage()
      process.exit(0)
    } else {
      throw new Error(`Unknown argument "${arg}". Run with --help for usage.`)
    }
  }
  return options
}

function printUsage(): void {
  console.log(`Usage: npx tsx scripts/backfill-encryption.ts [options]

Options:
  --dry-run            Report what would be encrypted. This is the DEFAULT.
  --apply              Write the encrypted values. (alias: --write)
  --table=<name>       Only process one table. One of: ${[...ALLOWED_TABLES].sort().join(", ")}
  --batch-size=<n>     Rows fetched per batch (default: 500).
  --help               Show this message.

Environment:
  PROPDESK_ENCRYPTION_KEYS   required to write (JSON registry of base64 32-byte keys)
  PROPDESK_BLIND_INDEX_KEYS  required to write blind indexes
  DATABASE_URL               Neon connection string (POSTGRES_URL also accepted)`)
}

/* -------------------------------------------------------------------------- */
/* Table / column safety                                                       */
/* -------------------------------------------------------------------------- */

function assertSafeTable(table: string): string {
  if (!SAFE_IDENTIFIER.test(table) || !ALLOWED_TABLES.has(table)) {
    throw new Error(
      `Refusing to touch "${table}": not a table in the encryption plan. Allowed: ${[...ALLOWED_TABLES].sort().join(", ")}`,
    )
  }
  return table
}

function assertSafeColumn(column: string): string {
  if (!SAFE_IDENTIFIER.test(column)) {
    throw new Error(`Refusing to touch the column "${column}": not a plain identifier.`)
  }
  return column
}

/* -------------------------------------------------------------------------- */
/* The backfill                                                                */
/* -------------------------------------------------------------------------- */

interface TableStats {
  table: string
  rowsScanned: number
  rowsUpdated: number
  valuesEncrypted: number
  valuesSkipped: number
  missing: boolean
  note?: string
}

/**
 * Run a statement with bound parameters.
 *
 * `sql.query(text, params)` is the Neon HTTP driver's bound-parameter call:
 * `$1`, `$2`, … in the text are replaced by the values in `params` — values
 * are never interpolated into the SQL string.
 */
async function runQuery(
  sql: ReturnType<typeof getDb>,
  text: string,
  params: unknown[],
): Promise<Array<Record<string, unknown>>> {
  const rows = await sql.query(text, params)
  return (rows ?? []) as Array<Record<string, unknown>>
}

/**
 * Load the real column list of a table. The plan covers both the Neon schema
 * and the Supabase-only tables, so a column may legitimately be absent.
 */
async function loadTableColumns(
  sql: ReturnType<typeof getDb>,
  table: string,
): Promise<Set<string>> {
  const rows = await runQuery(
    sql,
    `select column_name from information_schema.columns
      where table_schema = 'public' and table_name = $1`,
    [table],
  )
  return new Set(rows.map((row) => String(row.column_name)))
}

/**
 * Encrypt one plaintext value for a column spec. Returns the new value, or
 * `null` when the value does not need encrypting.
 */
function encryptValue(spec: PiiColumnSpec, value: string): string | null {
  if (value === "") return null
  if (isEncryptedField(value)) return null
  return encryptField(value, { context: spec.context })
}

/**
 * Compute the blind index of a plaintext value for a spec.
 */
function blindIndexFor(spec: PiiColumnSpec, plaintext: string): string | null {
  if (!spec.blindIndexColumn) return null
  return blindIndex(plaintext, { normalize: normalizerFor(spec) })
}

async function backfillTable(
  sql: ReturnType<typeof getDb>,
  table: string,
  specs: PiiColumnSpec[],
  options: Options,
): Promise<TableStats> {
  const stats: TableStats = {
    table,
    rowsScanned: 0,
    rowsUpdated: 0,
    valuesEncrypted: 0,
    valuesSkipped: 0,
    missing: false,
  }

  const present = await loadTableColumns(sql, table)
  if (present.size === 0) {
    stats.missing = true
    stats.note = "table not present in this database — skipped"
    return stats
  }

  const liveSpecs = specs.filter((spec) => present.has(spec.column))
  if (liveSpecs.length === 0) {
    stats.note = "none of the planned columns exist in this database — skipped"
    return stats
  }

  const columns = liveSpecs.map((spec) => spec.column)
  const columnList = columns.map((column) => `"${assertSafeColumn(column)}"`).join(", ")
  const anyNotNull = columns
    .map((column) => `"${assertSafeColumn(column)}" is not null`)
    .join(" or ")
  const hasUpdatedAt = present.has("updated_at")

  let lastId = "00000000-0000-0000-0000-000000000000"

  for (;;) {
    const selectText =
      `select id, ${columnList} from public."${table}" ` +
      `where (${anyNotNull}) and id > $1 order by id asc limit $2`
    const rows = await runQuery(sql, selectText, [lastId, options.batchSize])
    if (!rows || rows.length === 0) break

    for (const row of rows) {
      stats.rowsScanned += 1
      lastId = String(row.id)

      // Collect the values that still need encrypting.
      const updates: Array<{ column: string; value: string; blindIndexColumn?: string; blindIndex?: string }> = []

      for (const spec of liveSpecs) {
        const current = row[spec.column]
        if (typeof current !== "string") {
          stats.valuesSkipped += 1
          continue
        }
        const encrypted = encryptValue(spec, current)
        if (!encrypted) {
          stats.valuesSkipped += 1
          continue
        }
        stats.valuesEncrypted += 1
        const bidxColumn = blindIndexColumnFor(table, spec.column)
        updates.push({
          column: spec.column,
          value: encrypted,
          blindIndexColumn: bidxColumn,
          blindIndex: bidxColumn ? blindIndexFor(spec, current) ?? undefined : undefined,
        })
      }

      if (updates.length === 0) continue
      stats.rowsUpdated += 1

      if (!options.apply) continue

      // One UPDATE per row, every value bound as a parameter.
      const sets: string[] = []
      const params: unknown[] = []
      let paramIndex = 1
      for (const update of updates) {
        sets.push(`"${assertSafeColumn(update.column)}" = $${paramIndex}`)
        params.push(update.value)
        paramIndex += 1
        if (update.blindIndexColumn && update.blindIndex) {
          sets.push(`"${assertSafeColumn(update.blindIndexColumn)}" = $${paramIndex}`)
          params.push(update.blindIndex)
          paramIndex += 1
        }
      }
      if (hasUpdatedAt) sets.push(`updated_at = now()`)
      params.push(row.id)

      const updateText =
        `update public."${table}" set ${sets.join(", ")} where id = $${paramIndex}`
      await runQuery(sql, updateText, params)
    }

    if (rows.length < options.batchSize) break
  }

  return stats
}

/* -------------------------------------------------------------------------- */
/* Entry point                                                                  */
/* -------------------------------------------------------------------------- */

async function main(): Promise<number> {
  let options: Options
  try {
    options = parseArgs(process.argv.slice(2))
    // Validate the requested table before anything else: a table name is an
    // identifier that reaches the SQL, so it must be on the allowlist.
    if (options.table) assertSafeTable(options.table)
  } catch (error) {
    console.error(`✗ ${(error as Error).message}`)
    return 1
  }

  console.log("PropDesk encryption backfill")
  console.log(`  mode:       ${options.apply ? "APPLY (writes)" : "DRY RUN (no writes)"}`)
  console.log(`  batch size: ${options.batchSize}`)

  if (!neonConfigured()) {
    console.log("")
    console.log("No database configured — nothing to do.")
    console.log("  Set DATABASE_URL (or POSTGRES_URL) to the Neon connection string and re-run.")
    return 0
  }

  // Fail closed: without a usable key the backfill must not run.
  let keyError: string | null = null
  try {
    const registry = getKeyRegistry()
    if (registry.blindIndexKeys.size === 0) {
      keyError =
        "No blind-index key configured. Set PROPDESK_BLIND_INDEX_KEYS to a JSON object " +
        'such as { "b1": "<base64 of 32 random bytes>" } (generate with: openssl rand -base64 32).'
    }
  } catch (error) {
    keyError = (error as Error).message
  }

  if (keyError) {
    if (!options.apply) {
      console.log("")
      console.log(`! Key configuration problem: ${keyError}`)
      console.log("  A dry run does not need the key; a real run does. Fix the environment and re-run with --apply.")
    } else {
      console.error(`✗ ${keyError}`)
      return 1
    }
  }

  const tables = options.table
    ? [assertSafeTable(options.table)]
    : Array.from(new Set(PII_COLUMNS.map((spec) => spec.table)))

  const sql = getDb()
  const allStats: TableStats[] = []

  for (const table of tables) {
    const specs = specsForTable(table)
    if (specs.length === 0) {
      console.log(`- ${table}: no protected columns — skipped`)
      continue
    }
    try {
      const stats = await backfillTable(sql, table, specs, options)
      allStats.push(stats)
      if (stats.note) {
        console.log(`- ${table}: ${stats.note}`)
        continue
      }
      console.log(
        `- ${table}: scanned ${stats.rowsScanned} rows, ` +
          `${stats.valuesEncrypted} values to encrypt, ${stats.valuesSkipped} values skipped ` +
          `(${stats.rowsUpdated} rows ${options.apply ? "updated" : "would be updated"})`,
      )
    } catch (error) {
      const message = (error as Error)?.message || String(error)
      // A table that does not exist in this deployment is not a failure — the
      // plan covers both the Neon schema and the Supabase-only tables.
      if (/does not exist|undefined_table|42P01/i.test(message)) {
        console.log(`- ${table}: table not present in this database — skipped`)
        allStats.push({
          table,
          rowsScanned: 0,
          rowsUpdated: 0,
          valuesEncrypted: 0,
          valuesSkipped: 0,
          missing: true,
        })
        continue
      }
      console.error(`✗ ${table}: ${message}`)
      return 1
    }
  }

  const totals = allStats.reduce(
    (acc, stats) => ({
      rowsScanned: acc.rowsScanned + stats.rowsScanned,
      rowsUpdated: acc.rowsUpdated + stats.rowsUpdated,
      valuesEncrypted: acc.valuesEncrypted + stats.valuesEncrypted,
      valuesSkipped: acc.valuesSkipped + stats.valuesSkipped,
    }),
    { rowsScanned: 0, rowsUpdated: 0, valuesEncrypted: 0, valuesSkipped: 0 },
  )

  console.log("")
  console.log("Summary")
  console.log(`  rows scanned:        ${totals.rowsScanned}`)
  console.log(`  rows encrypted:      ${totals.rowsUpdated}`)
  console.log(`  values encrypted:    ${totals.valuesEncrypted}`)
  console.log(`  values skipped:      ${totals.valuesSkipped}`)
  if (!options.apply && totals.valuesEncrypted > 0) {
    console.log("")
    console.log("This was a DRY RUN — nothing was written. Re-run with --apply to encrypt.")
  }
  return 0
}

main()
  .then((code) => {
    process.exitCode = code
  })
  .catch((error) => {
    console.error(`✗ ${(error as Error)?.message || String(error)}`)
    process.exitCode = 1
  })
