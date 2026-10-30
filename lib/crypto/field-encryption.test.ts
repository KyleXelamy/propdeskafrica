/**
 * lib/crypto/field-encryption.test.ts
 *
 * Runtime tests for the encryption-at-rest core (vitest).
 *
 * The keys are DETERMINISTIC test keys, set inside this file — no real key
 * material is ever read from the environment or written to disk. The registry
 * is memoised, so `resetKeyRegistry()` runs before every test to rebuild it
 * from the environment that this file controls.
 *
 * Source of truth: audit/design/encryption-design.md §5 (envelope), §6 (the
 * module under test), §9 (blind index), §10.2 (constant-time compare) and
 * §18.1 (the cases below).
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest"

import {
  AUTH_TAG_LENGTH,
  CIPHER_ALGORITHM,
  ENVELOPE_VERSION,
  FieldEncryptionError,
  IV_LENGTH,
  KEY_LENGTH,
  blindIndex,
  blindIndexCandidates,
  decryptField,
  decryptFieldStrict,
  decryptFieldWithRotation,
  encryptField,
  getEnvelopeKeyId,
  getKeyRegistry,
  isEncryptedField,
  phoneLookupForms,
  resetKeyRegistry,
  timingSafeEqualString,
} from "./field-encryption"

import {
  PII_COLUMNS,
  blindIndexColumnFor,
  decryptRow,
  decryptRowWithReport,
  encryptRow,
  migrationReportFor,
  normalizePhoneE164,
  specsForTable,
} from "./pii-columns"

import { normalizePhone } from "../mpesa/daraja"

/* -------------------------------------------------------------------------- */
/* Deterministic test keys (32 bytes each, base64)                             */
/* -------------------------------------------------------------------------- */

/** 32 bytes: "0123456789abcdef0123456789abcdef" */
const KEY_V1 = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="
/** 32 bytes: "fedcba9876543210fedcba9876543210" */
const KEY_V2 = "ZmVkY2JhOTg3NjU0MzIxMGZlZGNiYTk4NzY1NDMyMTA="
/** 32 bytes: "blind-index-key-b1-32-bytes-abcx" */
const BIDX_B1 = "YmxpbmQtaW5kZXgta2V5LWIxLTMyLWJ5dGVzLWFiY3g="
/** 32 bytes: "blind-index-key-b2-32-bytes-xyzy" */
const BIDX_B2 = "YmxpbmQtaW5kZXgta2V5LWIyLTMyLWJ5dGVzLXh5enk="

const ENCRYPTION_KEYS_V1 = JSON.stringify({ v1: KEY_V1 })
const ENCRYPTION_KEYS_V1_V2 = JSON.stringify({ v1: KEY_V1, v2: KEY_V2 })
const BLIND_INDEX_KEYS_B1 = JSON.stringify({ b1: BIDX_B1 })
const BLIND_INDEX_KEYS_B1_B2 = JSON.stringify({ b1: BIDX_B1, b2: BIDX_B2 })

const ORIGINAL_ENV = {
  PROPDESK_ENCRYPTION_KEYS: process.env.PROPDESK_ENCRYPTION_KEYS,
  PROPDESK_ENCRYPTION_KEY: process.env.PROPDESK_ENCRYPTION_KEY,
  PROPDESK_BLIND_INDEX_KEYS: process.env.PROPDESK_BLIND_INDEX_KEYS,
  PROPDESK_BLIND_INDEX_KEY: process.env.PROPDESK_BLIND_INDEX_KEY,
}

/**
 * Point the module at a specific set of test keys and rebuild the memoised
 * registry.
 */
function useKeys(
  encryptionKeys: string | null = ENCRYPTION_KEYS_V1,
  blindIndexKeys: string | null = BLIND_INDEX_KEYS_B1,
): void {
  if (encryptionKeys === null) delete process.env.PROPDESK_ENCRYPTION_KEYS
  else process.env.PROPDESK_ENCRYPTION_KEYS = encryptionKeys
  if (blindIndexKeys === null) delete process.env.PROPDESK_BLIND_INDEX_KEYS
  else process.env.PROPDESK_BLIND_INDEX_KEYS = blindIndexKeys
  delete process.env.PROPDESK_ENCRYPTION_KEY
  delete process.env.PROPDESK_BLIND_INDEX_KEY
  resetKeyRegistry()
}

beforeEach(() => {
  useKeys()
})

afterAll(() => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  resetKeyRegistry()
})

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Flip a byte inside one segment of an envelope, keeping the envelope
 * well-formed (so the failure is an authentication failure, not a parse
 * failure).
 */
function tamperSegment(envelope: string, index: number): string {
  const parts = envelope.split(":")
  const bytes = Buffer.from(parts[index], "base64")
  bytes[0] = bytes[0] ^ 0xff
  parts[index] = bytes.toString("base64")
  return parts.join(":")
}

const CONTEXT = "tenants.national_id"

describe("field-encryption: envelope format", () => {
  it("uses the documented algorithm, version and segment sizes", () => {
    expect(CIPHER_ALGORITHM).toBe("aes-256-gcm")
    expect(ENVELOPE_VERSION).toBe("v1")
    expect(IV_LENGTH).toBe(12)
    expect(AUTH_TAG_LENGTH).toBe(16)
    expect(KEY_LENGTH).toBe(32)
  })

  it("produces v1:<iv>:<tag>:<ciphertext> with the right byte lengths", () => {
    const envelope = encryptField("23456789", { context: CONTEXT }) as string
    const parts = envelope.split(":")
    expect(parts).toHaveLength(4)
    expect(parts[0]).toBe("v1")
    expect(Buffer.from(parts[1], "base64")).toHaveLength(IV_LENGTH)
    expect(Buffer.from(parts[2], "base64")).toHaveLength(AUTH_TAG_LENGTH)
    expect(Buffer.from(parts[3], "base64")).toHaveLength("23456789".length)
  })

  it("keeps null and undefined distinct from an empty string", () => {
    expect(encryptField(null)).toBeNull()
    expect(encryptField(undefined)).toBeNull()
    expect(decryptField(null)).toBeNull()
    expect(decryptField(undefined)).toBeNull()

    const envelope = encryptField("", { context: CONTEXT }) as string
    expect(envelope).toMatch(/^v1:/)
    expect(decryptField(envelope, { context: CONTEXT })).toBe("")
  })
})

describe("field-encryption: round trip", () => {
  it("round-trips an ASCII value", () => {
    const value = "Ada K. Kimani"
    expect(decryptField(encryptField(value, { context: CONTEXT }), { context: CONTEXT })).toBe(value)
  })

  it("round-trips an empty string", () => {
    const envelope = encryptField("", { context: CONTEXT }) as string
    expect(decryptField(envelope, { context: CONTEXT })).toBe("")
  })

  it("round-trips unicode and emoji", () => {
    const value = "🇰🇪 Nairobi — Ünïcödé ✅ 住所"
    expect(decryptField(encryptField(value, { context: CONTEXT }), { context: CONTEXT })).toBe(value)
  })

  it("round-trips a long (10 KB) string", () => {
    const value = "a".repeat(10 * 1024)
    expect(decryptField(encryptField(value, { context: CONTEXT }), { context: CONTEXT })).toBe(value)
  })

  it("round-trips a value encrypted without a context", () => {
    const value = "no context"
    expect(decryptField(encryptField(value))).toBe(value)
  })
})

describe("field-encryption: randomised mode", () => {
  it("produces a different ciphertext for every encryption of the same plaintext", () => {
    const value = "0712345678"
    const first = encryptField(value, { context: CONTEXT }) as string
    const second = encryptField(value, { context: CONTEXT }) as string

    expect(first).not.toBe(second)
    expect(first.split(":")[1]).not.toBe(second.split(":")[1]) // different IV
    expect(decryptField(first, { context: CONTEXT })).toBe(value)
    expect(decryptField(second, { context: CONTEXT })).toBe(value)
  })
})

describe("field-encryption: authentication", () => {
  it("throws when the ciphertext is tampered with", () => {
    const envelope = encryptField("0712345678", { context: CONTEXT }) as string
    const tampered = tamperSegment(envelope, 3) // ciphertext
    expect(() => decryptField(tampered, { context: CONTEXT })).toThrow(FieldEncryptionError)
  })

  it("throws when the auth tag is tampered with", () => {
    const envelope = encryptField("0712345678", { context: CONTEXT }) as string
    const tampered = tamperSegment(envelope, 2) // auth tag
    expect(() => decryptField(tampered, { context: CONTEXT })).toThrow(FieldEncryptionError)
  })

  it("throws when the IV is tampered with", () => {
    const envelope = encryptField("0712345678", { context: CONTEXT }) as string
    const tampered = tamperSegment(envelope, 1) // iv
    expect(() => decryptField(tampered, { context: CONTEXT })).toThrow(FieldEncryptionError)
  })

  it("throws when the context does not match", () => {
    const envelope = encryptField("0712345678", { context: "tenants.national_id" }) as string
    expect(() => decryptField(envelope, { context: "tenants.phone" })).toThrow(FieldEncryptionError)
  })

  it("throws for an unknown key id and names the key id", () => {
    const envelope = encryptField("0712345678", { context: CONTEXT }) as string
    const unknown = `v9${envelope.slice(2)}`
    expect(() => decryptField(unknown, { context: CONTEXT })).toThrow(/v9/)
  })
})

describe("field-encryption: legacy plaintext", () => {
  it("does not treat a plaintext value as an envelope", () => {
    expect(isEncryptedField("23456789")).toBe(false)
    expect(isEncryptedField("")).toBe(false)
    expect(isEncryptedField(null)).toBe(false)
    expect(isEncryptedField(undefined)).toBe(false)
    expect(isEncryptedField(encryptField("23456789", { context: CONTEXT }))).toBe(true)
  })

  it("passes a plaintext value through decryptField unchanged", () => {
    expect(decryptField("23456789", { context: CONTEXT })).toBe("23456789")
  })

  it("throws for a plaintext value in decryptFieldStrict", () => {
    expect(() => decryptFieldStrict("23456789", { context: CONTEXT })).toThrow(FieldEncryptionError)
  })

  it("flags a plaintext value for encryption via decryptFieldWithRotation", () => {
    const res = decryptFieldWithRotation("23456789", { context: CONTEXT })
    expect(res?.plaintext).toBe("23456789")
    expect(res?.keyId).toBe("")
    expect(res?.reencrypted).toBeTruthy()
    expect(getEnvelopeKeyId(res?.reencrypted ?? null)).toBe("v1")
  })
})

describe("field-encryption: key registry and rotation", () => {
  it("memoises the registry and rebuilds it after resetKeyRegistry()", () => {
    const first = getKeyRegistry()
    expect(getKeyRegistry()).toBe(first)

    resetKeyRegistry()
    expect(getKeyRegistry()).not.toBe(first)
  })

  it("uses the highest key id as the active key", () => {
    expect(getKeyRegistry().activeKeyId).toBe("v1")

    useKeys(JSON.stringify({ v1: KEY_V1, v2: KEY_V2 }))
    expect(getKeyRegistry().activeKeyId).toBe("v2")

    // Natural ordering: v10 is newer than v9.
    const v9 = Buffer.alloc(32, 9).toString("base64")
    const v10 = Buffer.alloc(32, 10).toString("base64")
    useKeys(JSON.stringify({ v9, v10 }))
    expect(getKeyRegistry().activeKeyId).toBe("v10")
  })

  it("decrypts a ciphertext written under an older key id", () => {
    useKeys(ENCRYPTION_KEYS_V1)
    const legacy = encryptField("0712345678", { context: CONTEXT }) as string
    expect(getEnvelopeKeyId(legacy)).toBe("v1")

    useKeys(ENCRYPTION_KEYS_V1_V2)
    expect(decryptField(legacy, { context: CONTEXT })).toBe("0712345678")
  })

  it("re-encrypts an old ciphertext under the active key", () => {
    useKeys(ENCRYPTION_KEYS_V1)
    const legacy = encryptField("0712345678", { context: CONTEXT }) as string

    useKeys(ENCRYPTION_KEYS_V1_V2)
    const res = decryptFieldWithRotation(legacy, { context: CONTEXT })
    expect(res?.plaintext).toBe("0712345678")
    expect(res?.keyId).toBe("v1")
    expect(res?.reencrypted).toBeTruthy()
    expect(getEnvelopeKeyId(res?.reencrypted ?? null)).toBe("v2")
    expect(decryptField(res?.reencrypted as string, { context: CONTEXT })).toBe("0712345678")
    // The re-encrypted value is a fresh ciphertext, not the old envelope.
    expect(res?.reencrypted).not.toBe(legacy)
  })

  it("does not re-encrypt a value that is already under the active key", () => {
    useKeys(ENCRYPTION_KEYS_V1_V2)
    const current = encryptField("0712345678", { context: CONTEXT }) as string
    const res = decryptFieldWithRotation(current, { context: CONTEXT })
    expect(res?.keyId).toBe("v2")
    expect(res?.reencrypted).toBeNull()
  })

  it("throws when no encryption key is configured", () => {
    useKeys(null, BLIND_INDEX_KEYS_B1)
    expect(() => getKeyRegistry()).toThrow(FieldEncryptionError)
    expect(() => encryptField("x")).toThrow(/PROPDESK_ENCRYPTION_KEYS/)
  })

  it("throws when a key is not exactly 32 bytes", () => {
    useKeys(JSON.stringify({ v1: Buffer.alloc(16, 1).toString("base64") }))
    expect(() => getKeyRegistry()).toThrow(/32 bytes/)
  })

  it("throws when the registry is malformed", () => {
    useKeys("{not json")
    expect(() => getKeyRegistry()).toThrow(/not valid JSON/)
  })
})

describe("field-encryption: blind index", () => {
  it("is stable for equal inputs", () => {
    expect(blindIndex("0712345678")).toBe(blindIndex("0712345678"))
    expect(blindIndex("ada@example.com")).toBe(blindIndex("ada@example.com"))
  })

  it("differs for different inputs", () => {
    expect(blindIndex("0712345678")).not.toBe(blindIndex("0712345679"))
    expect(blindIndex("ada@example.com")).not.toBe(blindIndex("bob@example.com"))
  })

  it("does not contain the plaintext", () => {
    const idx = blindIndex("0712345678") as string
    expect(idx).not.toContain("0712345678")
    expect(idx).toMatch(/^b1:[0-9a-f]{64}$/)
  })

  it("is normalisation-independent for phone numbers", () => {
    const a = blindIndex("0712345678", { normalize: normalizePhoneE164 })
    const b = blindIndex("254712345678", { normalize: normalizePhoneE164 })
    const c = blindIndex("+254 712 345 678", { normalize: normalizePhoneE164 })
    expect(a).toBe(b)
    expect(b).toBe(c)
  })

  it("returns a candidate for every registered blind-index key", () => {
    useKeys(ENCRYPTION_KEYS_V1, BLIND_INDEX_KEYS_B1_B2)
    const candidates = blindIndexCandidates("0712345678")
    expect(candidates.some((c) => c.startsWith("b1:"))).toBe(true)
    expect(candidates.some((c) => c.startsWith("b2:"))).toBe(true)
  })
})

describe("field-encryption: blind index candidates for a Kenyan phone number", () => {
  it("returns multiple candidates for a Kenyan phone number", () => {
    const candidates = blindIndexCandidates("0712345678")
    expect(candidates.length).toBeGreaterThan(1)
    expect(new Set(candidates).size).toBe(candidates.length) // de-duplicated
  })

  it("covers 0712345678, 254712345678, +254712345678 and 712345678", () => {
    for (const input of ["0712345678", "254712345678", "+254712345678", "712345678"]) {
      const candidates = blindIndexCandidates(input)
      expect(candidates.length).toBeGreaterThan(1)
      for (const form of ["0712345678", "254712345678", "+254712345678", "712345678"]) {
        expect(candidates).toContain(blindIndex(form))
      }
    }
  })

  it("includes the canonical E.164 candidate — the one the write path stores", () => {
    const candidates = blindIndexCandidates("0712345678")
    expect(candidates).toContain(blindIndex(normalizePhoneE164("0712345678")))
  })

  it("produces the same candidate set for every form of the same number", () => {
    const a = blindIndexCandidates("0712345678").sort()
    const b = blindIndexCandidates("+254712345678").sort()
    expect(a).toEqual(b)
  })

  it("lists the literal forms of a Kenyan number", () => {
    expect(phoneLookupForms("0712345678")).toEqual(
      expect.arrayContaining(["0712345678", "712345678", "254712345678"]),
    )
    // The candidate set depends on the number, not on the punctuation.
    expect(phoneLookupForms("+254712345678").sort()).toEqual(
      phoneLookupForms("0712345678").sort(),
    )
  })
})

describe("field-encryption: constant-time comparison", () => {
  it("returns true for equal strings", () => {
    expect(timingSafeEqualString("s3cr3t", "s3cr3t")).toBe(true)
    expect(timingSafeEqualString("", "")).toBe(true)
  })

  it("returns false for different strings", () => {
    expect(timingSafeEqualString("s3cr3t", "s3cr3T")).toBe(false)
    expect(timingSafeEqualString("s3cr3t", "other")).toBe(false)
  })

  it("returns false — and does NOT throw — when the lengths differ", () => {
    expect(() => timingSafeEqualString("short", "a-much-longer-secret")).not.toThrow()
    expect(timingSafeEqualString("short", "a-much-longer-secret")).toBe(false)
    expect(timingSafeEqualString("a", "")).toBe(false)
  })

  it("returns false for null and undefined", () => {
    expect(timingSafeEqualString(null, "x")).toBe(false)
    expect(timingSafeEqualString("x", null)).toBe(false)
    expect(timingSafeEqualString(undefined, undefined)).toBe(false)
  })
})

describe("field-encryption: phone normalisation", () => {
  it("normalises every accepted Kenyan phone form to E.164", () => {
    for (const input of ["0712345678", "+254712345678", "254712345678", "712345678", "254 712 345 678"]) {
      expect(normalizePhoneE164(input)).toBe("254712345678")
    }
  })

  it("matches lib/mpesa/daraja.ts normalizePhone byte for byte", () => {
    for (const input of ["0712345678", "+254712345678", "254712345678", "712345678", "254 712 345 678"]) {
      expect(normalizePhoneE164(input)).toBe(normalizePhone(input))
    }
  })
})

describe("pii-columns: the plan", () => {
  it("covers the columns that actually exist in the schema", () => {
    const keys = PII_COLUMNS.map((spec) => `${spec.table}.${spec.column}`)
    expect(keys).toContain("tenants.national_id")
    expect(keys).toContain("tenants.phone")
    expect(keys).toContain("tenants.email")
    expect(keys).toContain("c2b_transactions.msisdn")
    expect(keys).toContain("mpesa_transactions.phone")
  })

  it("gives the searchable columns a blind-index column", () => {
    expect(blindIndexColumnFor("tenants", "phone")).toBe("phone_blind_index")
    expect(blindIndexColumnFor("tenants", "email")).toBe("email_blind_index")
    expect(blindIndexColumnFor("c2b_transactions", "msisdn")).toBe("msisdn_blind_index")
    expect(blindIndexColumnFor("mpesa_transactions", "phone")).toBe("phone_blind_index")
    expect(blindIndexColumnFor("tenants", "national_id")).toBeUndefined()
  })

  it("never encrypts a column without a stable AAD context", () => {
    for (const spec of PII_COLUMNS) {
      if (spec.mode === "plaintext") continue
      expect(spec.context).toBe(`${spec.table}.${spec.column}`)
    }
  })
})

describe("pii-columns: row helpers", () => {
  it("encrypts a plaintext row and writes the blind index", () => {
    const row: Record<string, unknown> = {
      national_id: "23456789",
      phone: "0712345678",
      email: "Ada@Example.com",
      full_name: "Ada K.",
    }

    encryptRow("tenants", row)

    expect(isEncryptedField(row.national_id as string)).toBe(true)
    expect(isEncryptedField(row.phone as string)).toBe(true)
    expect(isEncryptedField(row.email as string)).toBe(true)
    expect(isEncryptedField(row.full_name as string)).toBe(true)
    expect(row.phone_blind_index).toBe(blindIndex(normalizePhoneE164("0712345678")))
    expect(row.email_blind_index).toBe(blindIndex("ada@example.com"))
  })

  it("is idempotent on write — an already-encrypted value is left alone", () => {
    const row: Record<string, unknown> = { national_id: "23456789", phone: "0712345678" }
    encryptRow("tenants", row)
    const encrypted = row.national_id

    encryptRow("tenants", row)

    expect(row.national_id).toBe(encrypted)
  })

  it("decrypts a row back to the original values", () => {
    const row: Record<string, unknown> = {
      national_id: "23456789",
      phone: "0712345678",
      email: "ada@example.com",
      full_name: "Ada K.",
    }
    encryptRow("tenants", row)
    decryptRow("tenants", row)

    expect(row.national_id).toBe("23456789")
    expect(row.phone).toBe("0712345678")
    expect(row.email).toBe("ada@example.com")
    expect(row.full_name).toBe("Ada K.")
  })

  it("reads a legacy plaintext row back unchanged and flags it for migration", () => {
    const row: Record<string, unknown> = { national_id: "23456789", phone: "0712345678" }

    expect(() => decryptRow("tenants", row)).not.toThrow()
    expect(row.national_id).toBe("23456789")
    expect(row.phone).toBe("0712345678")

    const report = migrationReportFor(row)
    expect(report?.needsMigration).toEqual(["national_id", "phone"])
  })

  it("reports the columns that need a migration", () => {
    const row: Record<string, unknown> = { national_id: "23456789", phone: "0712345678" }
    const { report } = decryptRowWithReport("tenants", row)
    expect(report.needsMigration).toEqual(["national_id", "phone"])
    expect(report.needsRotation).toEqual([])
  })

  it("reports a column encrypted under a retired key id", () => {
    useKeys(ENCRYPTION_KEYS_V1)
    const row: Record<string, unknown> = { national_id: "23456789" }
    encryptRow("tenants", row)

    useKeys(ENCRYPTION_KEYS_V1_V2)
    const { report } = decryptRowWithReport("tenants", row)
    expect(report.needsRotation).toEqual(["national_id"])
    expect(row.national_id).toBe("23456789")
  })

  it("does not encrypt a column that is not in the plan", () => {
    const row: Record<string, unknown> = { status: "active", monthly_rent: 45000 }
    encryptRow("tenants", row)
    expect(row.status).toBe("active")
    expect(row.monthly_rent).toBe(45000)
  })

  it("lists the protected columns of a table", () => {
    expect(specsForTable("tenants").map((s) => s.column)).toEqual([
      "national_id",
      "full_name",
      "first_name",
      "last_name",
      "email",
      "phone",
    ])
  })
})

/* -------------------------------------------------------------------------- */
/* Regression tests for the adversarial verification findings                  */
/* -------------------------------------------------------------------------- */

/**
 * A corrupt envelope must never be served as if it were data.
 *
 * Before this was fixed, `decryptField` returned ANY value that did not parse
 * as an envelope unchanged — so a truncated row, or one whose base64 was
 * mangled, was handed to the application as though it were plaintext. The
 * module already failed closed for an unknown key id; these tests make the
 * two paths consistent.
 */
describe("corrupt envelopes fail closed", () => {
  beforeEach(() => {
    useKeys()
  })

  it("throws for a truncated envelope", () => {
    const envelope = encryptField("0712345678")
    const truncated = envelope.split(":").slice(0, 3).join(":")
    expect(() => decryptField(truncated)).toThrow(FieldEncryptionError)
  })

  it("throws for an envelope whose ciphertext is not valid base64", () => {
    const envelope = encryptField("0712345678")
    const parts = envelope.split(":")
    const corrupted = [parts[0], parts[1], parts[2], "!!!not-base64!!!"].join(":")
    expect(() => decryptField(corrupted)).toThrow(FieldEncryptionError)
  })

  it("throws for an envelope with a wrong-length IV", () => {
    const corrupted = ["v1", "AAA", "AAAAAAAAAAAAAAAAAAAAAA", "AAAA"].join(":")
    expect(() => decryptField(corrupted)).toThrow(FieldEncryptionError)
  })

  it("still passes genuine legacy plaintext through unchanged", () => {
    expect(decryptField("0712345678")).toBe("0712345678")
    expect(decryptField("23456789")).toBe("23456789")
    // A legacy value that contains a colon but no registered key id is still
    // legacy plaintext — it must not be mistaken for an envelope.
    expect(decryptField("2024-01-01T10:00:00Z")).toBe("2024-01-01T10:00:00Z")
  })

  it("does not re-encrypt a corrupt envelope as if it were plaintext", () => {
    const envelope = encryptField("0712345678")
    const parts = envelope.split(":")
    const corrupted = [parts[0], parts[1], parts[2], "!!!not-base64!!!"].join(":")
    expect(() => decryptFieldWithRotation(corrupted)).toThrow(FieldEncryptionError)
  })

  it("refuses to read a corrupt cell through the row helper", () => {
    const row: Record<string, unknown> = {
      id: "t1",
      national_id: ["v1", "AAA", "AAAAAAAAAAAAAAAAAAAAAA", "AAAA"].join(":"),
    }
    expect(() => decryptRow("tenants", row)).toThrow(FieldEncryptionError)
  })

  it("does not report a corrupt cell as needing migration", () => {
    const row: Record<string, unknown> = {
      id: "t1",
      national_id: ["v1", "AAA", "AAAAAAAAAAAAAAAAAAAAAA", "AAAA"].join(":"),
    }
    expect(() => decryptRowWithReport("tenants", row)).toThrow(FieldEncryptionError)
  })
})

/**
 * The encryption key and the blind-index key must be different values.
 */
describe("the blind-index key cannot be the encryption key", () => {
  it("throws when both keys are the same material", () => {
    useKeys(ENCRYPTION_KEYS_V1, JSON.stringify({ b1: KEY_V1 }))
    expect(() => getKeyRegistry()).toThrow(/same key material/i)
  })
})

/**
 * The plan must cover the PII columns that exist in the primary schema.
 */
describe("the PII plan covers the primary schema", () => {
  it("protects user_profiles.phone", () => {
    const spec = PII_COLUMNS.find((s) => s.table === "user_profiles" && s.column === "phone")
    expect(spec).toBeDefined()
    expect(spec?.mode).toBe("blind-index")
    expect(spec?.blindIndexColumn).toBe("phone_blind_index")
  })

  it("protects documents.name", () => {
    const spec = PII_COLUMNS.find((s) => s.table === "documents" && s.column === "name")
    expect(spec).toBeDefined()
    expect(spec?.mode).toBe("randomised")
  })
})
