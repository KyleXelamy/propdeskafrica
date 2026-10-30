import { describe, expect, it } from "vitest"

import {
  BackupValidationError,
  assertAllowedBackupTable,
  buildExportCount,
  buildExportSelect,
  buildRestoreInsert,
  isSafeIdentifier,
  ownerColumnFor,
} from "./backup"

/**
 * Regression tests for the two SQL injections in the backup subsystem.
 *
 * 1. The TABLE name is an SQL identifier. POST /api/backup accepted a caller
 *    supplied `tables` array which was interpolated straight into
 *    `select * from public.${table} ...`.
 *
 * 2. The COLUMN names are an SQL identifier. A row in an uploaded backup has
 *    attacker-controlled keys (BackupPayloadSchema uses z.record(z.any())) and
 *    they were interpolated as quoted identifiers WITHOUT escaping the
 *    embedded double quote. The key below produced a valid statement that
 *    executed arbitrary SQL and stored the result in a row the attacker owns.
 *
 * These tests are hermetic: no database, no network, no Supabase.
 */

const EXPLOIT_KEY = 'name") values (($1::text || (select current_user))) --'

const ALLOWED = ["id", "user_id", "name", "address", "created_at"]

describe("table allowlist", () => {
  it.each([
    "properties; drop table x--",
    'users" where "1"="1',
    "public.properties",
    "Properties",
    "properties ",
    "",
  ])("rejects the crafted table name %j", (table) => {
    expect(isSafeIdentifier(table)).toBe(false)
    expect(() => assertAllowedBackupTable(table)).toThrow(BackupValidationError)
  })

  it("accepts an allowlisted table", () => {
    expect(assertAllowedBackupTable("properties")).toBe("properties")
    expect(assertAllowedBackupTable("tenants")).toBe("tenants")
  })

  it("rejects a well-formed but unknown table", () => {
    expect(() => assertAllowedBackupTable("app_users")).toThrow(BackupValidationError)
  })

  it("never lets a rejected table reach the SQL builder", () => {
    expect(() => buildExportSelect("properties; drop table x--", "user_id")).toThrow(
      BackupValidationError,
    )
    expect(() => buildExportCount('users" where "1"="1', "user_id")).toThrow(
      BackupValidationError,
    )
  })

  it("builds a scoped export statement for an allowed table", () => {
    expect(buildExportSelect("properties", "user_id")).toBe(
      "select * from public.properties where user_id = $1",
    )
    expect(buildExportCount("properties", "user_id")).toBe(
      "select count(*)::int as n from public.properties where user_id = $1",
    )
  })

  it("uses the id column for user_profiles and user_id elsewhere", () => {
    expect(ownerColumnFor("user_profiles")).toBe("id")
    expect(ownerColumnFor("tenants")).toBe("user_id")
  })

  it("rejects an unsafe owner column", () => {
    expect(() => buildExportSelect("properties", "user_id; drop table x")).toThrow(
      BackupValidationError,
    )
  })
})

describe("column allowlist", () => {
  it.each([
    EXPLOIT_KEY,
    `name" , "x') values (1) --`,
    'name"); drop table properties; --',
    "Name",
    "1name",
    "name ",
    "",
  ])("rejects the crafted column %j before building SQL", (column) => {
    expect(isSafeIdentifier(column)).toBe(false)
    expect(() =>
      buildRestoreInsert("properties", { [column]: "x" }, ALLOWED, "skip"),
    ).toThrow(BackupValidationError)
  })

  it("rejects a well-formed but unknown column", () => {
    expect(() =>
      buildRestoreInsert("properties", { nope: "x" }, ALLOWED, "skip"),
    ).toThrow(/Unknown column/)
  })

  it("rejects the whole restore rather than writing a partial row", () => {
    let built: unknown = null
    expect(() => {
      built = buildRestoreInsert("properties", { id: "1", nope: "x" }, ALLOWED, "skip")
    }).toThrow()
    expect(built).toBeNull()
  })

  it("builds a correct insert for a legitimate row", () => {
    const built = buildRestoreInsert(
      "properties",
      { id: "abc", name: "Nyumba" },
      ALLOWED,
      "skip",
    )
    expect(built.sql).toBe(
      'insert into public.properties ("id","name") values ($1,$2) on conflict do nothing',
    )
    expect(built.values).toEqual(["abc", "Nyumba"])
    expect(built.sql).not.toContain(EXPLOIT_KEY)
  })

  it.each(["replace", "merge"] as const)("guards the %s on-conflict branch too", (mode) => {
    expect(() =>
      buildRestoreInsert("properties", { [EXPLOIT_KEY]: "x" }, ALLOWED, mode, ["id"]),
    ).toThrow(BackupValidationError)
  })

  it("binds values as parameters and never interpolates them", () => {
    const built = buildRestoreInsert(
      "properties",
      { id: "1", name: "Robert'); drop table properties;--" },
      ALLOWED,
      "skip",
    )
    expect(built.sql).toBe(
      'insert into public.properties ("id","name") values ($1,$2) on conflict do nothing',
    )
    expect(built.sql).not.toContain("drop table")
    expect(built.values[1]).toBe("Robert'); drop table properties;--")
  })

  it("produces a valid on-conflict update for a legitimate row", () => {
    const built = buildRestoreInsert(
      "properties",
      { id: "abc", name: "Nyumba" },
      ALLOWED,
      "replace",
      ["id"],
    )
    expect(built.sql).toBe(
      'insert into public.properties ("id","name") values ($1,$2) on conflict ("id") do update set "name" = $2',
    )
  })

  it("never contains an injected substring in any built SQL", () => {
    const built = buildRestoreInsert("properties", { id: "1", name: "Nyumba" }, ALLOWED, "skip")
    expect(built.sql).not.toContain("values (($1::text")
    expect(built.sql).not.toContain("--")
  })
})
