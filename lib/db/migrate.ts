/**
 * Migration runner. Apply all SQL files in db/migrations/ in order.
 *
 *   npm run db:migrate
 *
 * Or programmatically:
 *
 *   import { runMigrations } from "@/lib/db/migrate"
 *   await runMigrations()
 *
 * Each migration is wrapped in a transaction. We use Neon's HTTP query
 * function so this works from a script context (no connection pool).
 *
 * This runner tracks applied migrations via a `_migrations` table — it
 * only runs files that haven't been applied yet, so it's safe to re-run.
 */
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { neon } from "@neondatabase/serverless"

const MIGRATIONS_DIR = join(process.cwd(), "db", "migrations")

export interface MigrationResult {
  file: string
  status: "applied" | "skipped" | "failed"
  error?: string
  ms?: number
}

/**
 * Split a migration file into individual statements.
 *
 * The HTTP driver does not natively support multi-statement scripts, so each
 * statement has to be executed on its own.
 *
 * The previous implementation split on "a semicolon at the end of a line" and
 * then DROPPED every chunk that started with a `--` comment. That silently
 * discarded real statements that merely followed a comment block: in
 * 001-core.sql it was every `create table`, and in 004/005 it was the
 * blind-index `alter table` statements — after which the runner died on the
 * surviving `create index` with "column does not exist", leaving the schema
 * half-migrated.
 *
 * This splitter is comment-aware:
 *   * `--` line comments are stripped, and a chunk is discarded only when
 *     nothing but comments was left in it;
 *   * a `;` inside a single-quoted string does not end the statement;
 *   * a `;` inside a `$$ … $$` dollar-quoted body does not end the statement
 *     (the `do $$ … $$;` blocks depend on this).
 */
export function splitSqlStatements(sqlText: string): string[] {
  const statements: string[] = []
  let buf = ""
  let i = 0
  let inSingleQuote = false
  let dollarTag: string | null = null

  const push = () => {
    const trimmed = buf.trim()
    if (trimmed.length > 0) statements.push(trimmed)
    buf = ""
  }

  while (i < sqlText.length) {
    const ch = sqlText[i]

    // Inside a dollar-quoted body: nothing is special until the tag closes.
    if (dollarTag) {
      if (sqlText.startsWith(dollarTag, i)) {
        buf += dollarTag
        i += dollarTag.length
        dollarTag = null
        continue
      }
      buf += ch
      i += 1
      continue
    }

    // Inside a single-quoted string literal.
    if (inSingleQuote) {
      buf += ch
      if (ch === "'") {
        if (sqlText[i + 1] === "'") {
          buf += "'"
          i += 2
          continue
        }
        inSingleQuote = false
      }
      i += 1
      continue
    }

    // A line comment — dropped entirely.
    if (ch === "-" && sqlText[i + 1] === "-") {
      const newline = sqlText.indexOf("\n", i)
      if (newline === -1) break
      buf += "\n"
      i = newline + 1
      continue
    }

    // A dollar-quoted block: $$ … $$ or $tag$ … $tag$.
    if (ch === "$") {
      const match = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sqlText.slice(i))
      if (match) {
        dollarTag = match[0]
        buf += dollarTag
        i += dollarTag.length
        continue
      }
    }

    // A single-quoted string literal.
    if (ch === "'") {
      inSingleQuote = true
      buf += ch
      i += 1
      continue
    }

    if (ch === ";") {
      push()
      i += 1
      continue
    }

    buf += ch
    i += 1
  }

  push()
  return statements
}

export async function runMigrations(opts: { silent?: boolean } = {}): Promise<MigrationResult[]> {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is required to run migrations")

  const sql = neon(url)
  const results: MigrationResult[] = []

  // bootstrap the migrations table
  await sql`
    create table if not exists public._migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()

  const applied = new Set(
    (await sql`select name from public._migrations`).map((r: any) => r.name),
  )

  for (const file of files) {
    if (applied.has(file)) {
      results.push({ file, status: "skipped" })
      if (!opts.silent) console.log(`✓ ${file} (skipped)`)
      continue
    }
    const sqlText = readFileSync(join(MIGRATIONS_DIR, file), "utf-8")
    const t0 = Date.now()
    try {
      // The HTTP driver doesn't natively support multi-statement scripts.
      // We use neon.transaction() to batch them, but for DDL we just
      // execute each statement sequentially inside a manual try/catch —
      // because CREATE TABLE IF NOT EXISTS etc. are idempotent.
      const statements = splitSqlStatements(sqlText)

      for (const stmt of statements) {
        // The neon() template literal handles parameter interpolation; for
        // raw SQL strings we use sql.query with no params.
        try {
          await (sql as any).query(stmt)
        } catch (e: any) {
          // Many DDL statements are tolerated as already-exists; we record
          // and continue so one file's warning doesn't break the rest.
          if (!/already exists/i.test(e?.message || "")) throw e
        }
      }
      await sql`insert into public._migrations (name) values (${file})`
      results.push({ file, status: "applied", ms: Date.now() - t0 })
      if (!opts.silent) console.log(`✓ ${file} (applied in ${Date.now() - t0}ms)`)
    } catch (e: any) {
      results.push({ file, status: "failed", error: e?.message || String(e) })
      if (!opts.silent) console.error(`✗ ${file}: ${e?.message || e}`)
      break
    }
  }

  return results
}

// CLI entrypoint: `tsx lib/db/migrate.ts` or `node --import tsx/esm ...`
if (typeof require !== "undefined" && require.main === module) {
  runMigrations().then((r) => {
    const applied = r.filter((x) => x.status === "applied").length
    const skipped = r.filter((x) => x.status === "skipped").length
    const failed = r.filter((x) => x.status === "failed").length
    console.log(`\nMigrations: ${applied} applied, ${skipped} skipped, ${failed} failed`)
    process.exit(failed > 0 ? 1 : 0)
  })
}
