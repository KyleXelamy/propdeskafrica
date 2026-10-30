/**
 * lib/db/migrate.test.ts
 *
 * The migration runner is the one piece of infrastructure everything else
 * depends on — if it silently skips statements, the schema is half-built and
 * the application fails at runtime instead of at deploy time.
 *
 * It used to split a file on "a semicolon at the end of a line" and then
 * DISCARD every chunk that started with a `--` comment. That silently threw
 * away real statements that merely followed a comment block: in 001-core.sql
 * it was every `create table`, and in 004/005 it was the blind-index `alter
 * table` statements — after which the runner died on the surviving `create
 * index` with "column does not exist".
 *
 * These tests pin the corrected behaviour.
 */

import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { splitSqlStatements } from "./migrate"

const MIGRATIONS_DIR = join(process.cwd(), "db", "migrations")

describe("splitSqlStatements", () => {
  it("keeps a statement that follows a comment block", () => {
    const sql = `
-- a comment describing the change
-- a second comment line
alter table public.tenants add column if not exists email_blind_index text;
`
    const statements = splitSqlStatements(sql)
    expect(statements).toHaveLength(1)
    expect(statements[0]).toBe(
      "alter table public.tenants add column if not exists email_blind_index text",
    )
  })

  it("drops a chunk that contains nothing but comments", () => {
    const sql = `
-- just a comment
-- another comment
`
    expect(splitSqlStatements(sql)).toHaveLength(0)
  })

  it("does not split on a semicolon inside a string literal", () => {
    const sql = `insert into public._migrations (name) values ('a;b');`
    const statements = splitSqlStatements(sql)
    expect(statements).toHaveLength(1)
    expect(statements[0]).toContain("'a;b'")
  })

  it("does not split on a semicolon inside a dollar-quoted body", () => {
    const sql = `
do $$ begin if to_regclass('public.c2b_transactions') is not null then
  execute 'alter table public.c2b_transactions add column if not exists msisdn_blind_index text';
end if; end $$;
`
    const statements = splitSqlStatements(sql)
    expect(statements).toHaveLength(1)
    expect(statements[0]).toContain("do $$")
  })

  it("does not treat a -- inside a string literal as a comment", () => {
    const sql = `insert into public.t (c) values ('a -- b');`
    const statements = splitSqlStatements(sql)
    expect(statements).toHaveLength(1)
    expect(statements[0]).toContain("'a -- b'")
  })

  it("keeps every statement of every migration file", () => {
    const files = ["001-core.sql", "002-support.sql", "004-marketing-forms.sql", "005-encryption.sql"]
    for (const file of files) {
      const sqlText = readFileSync(join(MIGRATIONS_DIR, file), "utf-8")
      const statements = splitSqlStatements(sqlText)

      // Nothing may be empty, and every statement must have real content.
      for (const statement of statements) {
        expect(statement.trim().length).toBeGreaterThan(0)
        expect(statement).not.toMatch(/^--/)
      }

      // The specific statements that the old runner dropped.
      if (file === "005-encryption.sql") {
        const joined = statements.join("\n")
        expect(joined).toContain("add column if not exists email_blind_index text")
        expect(joined).toContain("add column if not exists phone_blind_index text")
        expect(joined).toContain("add column if not exists msisdn_blind_index text")
        expect(joined).toContain("create extension if not exists")
      }
      if (file === "001-core.sql") {
        const joined = statements.join("\n")
        expect(joined).toContain("create table if not exists public.tenants")
        expect(joined).toContain("create table if not exists public.properties")
      }
      if (file === "002-support.sql") {
        // A plpgsql function body must arrive intact, not in fragments.
        const fn = statements.find((s) => s.includes("run_lease_expiry_scan"))
        expect(fn).toBeDefined()
        expect(fn).toContain("$$")
        expect(fn?.split("$$").length).toBeGreaterThanOrEqual(3)
      }
    }
  })
})
