/**
 * lib/crypto/pii-columns.ts
 *
 * The per-column encryption plan for PropDesk Africa, expressed as code so the
 * read and write paths cannot drift from the documented design
 * (audit/design/encryption-design.md §7) or from the real schema.
 *
 * WHAT THIS IS
 *   A list of every database column that holds PII, the mode used to protect
 *   it and — for the few columns that must stay searchable — the sibling
 *   column that holds the deterministic blind index. `encryptRow` / `decryptRow`
 *   apply the plan to a whole row so a route never has to remember which
 *   fields are sensitive.
 *
 * THE SCHEMA THIS PLAN IS BUILT FROM
 *   The design document (§7) lists columns from the Supabase-only schema
 *   (`contacts`, `managed_landlords`, `paybills`, `tenants.emergency_contact_*`).
 *   Those tables/columns do NOT exist in this project's Neon schema, so they
 *   are NOT in the plan below. The plan is built from what actually exists:
 *
 *     public.tenants             db/migrations/001-core.sql:76-94
 *       full_name, first_name, last_name, email, phone, national_id
 *     public.c2b_transactions    supabase-setup/10-holy-grail.sql:90-115
 *       msisdn, first_name, middle_name, last_name
 *     public.mpesa_transactions  db/migrations/002-support.sql:290-312
 *       phone
 *
 *   `tenants.national_id` (the Kenyan national ID) and `c2b_transactions.msisdn`
 *   (the payer's phone) are the two most sensitive columns in the plan.
 *
 * RUNTIME: Node.js only (imports node:crypto through ./field-encryption).
 */

import {
  blindIndex,
  decryptField,
  decryptFieldWithRotation,
  encryptField,
  FieldEncryptionError,
  getEnvelopeKeyId,
  getKeyRegistry,
  isCorruptEnvelope,
  isEncryptedField,
} from "./field-encryption"

/* -------------------------------------------------------------------------- */
/* The plan                                                                    */
/* -------------------------------------------------------------------------- */

export type FieldMode =
  /** AES-256-GCM with a fresh random IV on every write. Not searchable. */
  | "randomised"
  /**
   * AES-256-GCM for the value, plus a deterministic HMAC-SHA256 blind index
   * in a sibling column so the value stays searchable without revealing it.
   */
  | "blind-index"
  /** Deliberately not encrypted — see `rationale` for why. */
  | "plaintext"

export type LookupStrategy =
  /** Display only. Decrypt on read, never query by it. */
  | "none"
  /** Match with `WHERE <blindIndexColumn> = ANY($1)`. */
  | "blind-index"
  /** Load the candidate rows, decrypt in the app, compare in memory. */
  | "decrypt-in-app"

/** How a blind index is derived from the plaintext. */
export type BlindIndexKind = "phone-e164" | "email" | "text"

export interface PiiColumnSpec {
  /** Table the column belongs to. */
  table: string
  /** The column that holds the ciphertext (and the plaintext during migration). */
  column: string
  mode: FieldMode
  /** AAD context. Must be stable for the life of the column. */
  context: string
  lookup: LookupStrategy
  /** Sibling column holding the blind index (mode `blind-index` only). */
  blindIndexColumn?: string
  /**
   * Normaliser applied before computing the blind index. This IS the
   * blind-index kind — see `blindIndexKindFor()`.
   */
  normalize?: BlindIndexKind
  /** Why this column is treated the way it is. */
  rationale: string
}

/**
 * The plan. Every column listed here must be handled by `encryptRow` /
 * `decryptRow` on both the read and the write path.
 *
 * Blind-index columns are named `<column>_blind_index` (see
 * db/migrations/005-encryption.sql). The design document used the shorter
 * `<column>_bidx`; the SQL in 005-encryption.sql is the authority.
 */
export const PII_COLUMNS: readonly PiiColumnSpec[] = [
  /* ---------------------------------------------------------------- tenants */
  {
    table: "tenants",
    column: "national_id",
    mode: "randomised",
    context: "tenants.national_id",
    lookup: "none",
    rationale:
      "Kenyan national ID — the highest-value field in the schema (CRYPTO-001). Displayed, never searched, so a randomised envelope is enough: no blind index, no equality leakage.",
  },
  {
    table: "tenants",
    column: "full_name",
    mode: "randomised",
    context: "tenants.full_name",
    lookup: "none",
    rationale:
      "The tenant's legal name. Personal data under the Data Protection Act 2019. Displayed only. NOTE: db/migrations/002-support.sql:run_lease_expiry_scan() interpolates t.full_name into a notification message in SQL — that function must stop reading this column directly (see the integration checklist).",
  },
  {
    table: "tenants",
    column: "first_name",
    mode: "randomised",
    context: "tenants.first_name",
    lookup: "none",
    rationale: "Part of the tenant's legal name. Displayed only.",
  },
  {
    table: "tenants",
    column: "last_name",
    mode: "randomised",
    context: "tenants.last_name",
    lookup: "none",
    rationale: "Part of the tenant's legal name. Displayed only.",
  },
  {
    table: "tenants",
    column: "email",
    mode: "blind-index",
    context: "tenants.email",
    lookup: "blind-index",
    blindIndexColumn: "email_blind_index",
    normalize: "email",
    rationale:
      "Contact detail. Encrypted with a fresh IV (so the column leaks no equality) plus a deterministic blind index so 'find the tenant by email' works without decrypting the whole table. The design (§7) kept this column randomised because the product did not search by email yet; the blind index is purely additive.",
  },
  {
    table: "tenants",
    column: "phone",
    mode: "blind-index",
    context: "tenants.phone",
    lookup: "blind-index",
    blindIndexColumn: "phone_blind_index",
    normalize: "phone-e164",
    rationale:
      "Looked up by phone in the M-Pesa C2B validation path (app/api/mpesa/c2b/validation/route.ts:75-80) and compared in memory by the reconciliation engine (lib/reconcile.ts). Encrypted plus a blind index, or the public validation endpoint silently stops matching tenants (CRYPTO-002).",
  },

  /* -------------------------------------------------------- c2b_transactions */
  {
    table: "c2b_transactions",
    column: "msisdn",
    mode: "blind-index",
    context: "c2b_transactions.msisdn",
    lookup: "blind-index",
    blindIndexColumn: "msisdn_blind_index",
    normalize: "phone-e164",
    rationale:
      "The payer's MSISDN (CRYPTO-003). Personal data about a third party with no tenant FK behind it. Encrypted plus a blind index so the payer can be matched by phone without a cross-tenant table scan.",
  },
  {
    table: "c2b_transactions",
    column: "first_name",
    mode: "randomised",
    context: "c2b_transactions.first_name",
    lookup: "none",
    rationale: "Payer legal name (CRYPTO-003). Displayed only.",
  },
  {
    table: "c2b_transactions",
    column: "middle_name",
    mode: "randomised",
    context: "c2b_transactions.middle_name",
    lookup: "none",
    rationale: "Payer legal name (CRYPTO-003). Displayed only.",
  },
  {
    table: "c2b_transactions",
    column: "last_name",
    mode: "randomised",
    context: "c2b_transactions.last_name",
    lookup: "none",
    rationale: "Payer legal name (CRYPTO-003). Displayed only.",
  },
  {
    table: "c2b_transactions",
    column: "raw",
    mode: "plaintext",
    context: "c2b_transactions.raw",
    lookup: "none",
    rationale:
      "NOT a column to encrypt — REDACT it (CRYPTO-004). The whole Daraja payload duplicates MSISDN, payer name and receipt. Keep only TransID, TransTime, TransAmount, BusinessShortCode, BillRefNumber, MpesaReceiptNumber and ResultCode.",
  },

  /* ------------------------------------------------------ mpesa_transactions */
  {
    table: "mpesa_transactions",
    column: "phone",
    mode: "blind-index",
    context: "mpesa_transactions.phone",
    lookup: "blind-index",
    blindIndexColumn: "phone_blind_index",
    normalize: "phone-e164",
    rationale:
      "MSISDN of the payer on an STK push (db/migrations/002-support.sql:295, CRYPTO-003). Encrypted plus a blind index so the payer can be found by phone without decrypting every transaction.",
  },
  {
    table: "mpesa_transactions",
    column: "raw_response",
    mode: "plaintext",
    context: "mpesa_transactions.raw_response",
    lookup: "none",
    rationale:
      "Redact to the whitelist, as for c2b_transactions.raw (CRYPTO-004). The Daraja response echoes the MSISDN and the payer name.",
  },
  {
    table: "mpesa_transactions",
    column: "raw_callback",
    mode: "plaintext",
    context: "mpesa_transactions.raw_callback",
    lookup: "none",
    rationale:
      "Redact to the whitelist, as for c2b_transactions.raw (CRYPTO-004). The Daraja callback body echoes the MSISDN and the payer name.",
  },

  /* ----------------------------------------------------------- user_profiles */
  {
    table: "user_profiles",
    column: "phone",
    mode: "blind-index",
    context: "user_profiles.phone",
    lookup: "blind-index",
    blindIndexColumn: "phone_blind_index",
    normalize: "phone-e164",
    rationale:
      "The landlord's own phone number (db/migrations/001-core.sql:38). Encrypted plus a blind index so it can still be matched against a payer's MSISDN without decrypting every row.",
  },
  {
    table: "user_profiles",
    column: "full_name",
    mode: "randomised",
    context: "user_profiles.full_name",
    lookup: "none",
    rationale:
      "The landlord's legal name (db/migrations/001-core.sql:35). Displayed only.",
  },

  /* -------------------------------------------------------------- documents */
  {
    table: "documents",
    column: "name",
    mode: "randomised",
    context: "documents.name",
    lookup: "none",
    rationale:
      "The document filename (db/migrations/001-core.sql:189) — for identity documents this is itself identifying ('Wanjiku_National_ID.pdf'). Encrypted; never searched, so no blind index.",
  },
]

/** Every table the plan touches, in a stable order. */
export const PII_TABLES: readonly string[] = Array.from(
  new Set(PII_COLUMNS.map((spec) => spec.table)),
)

/* -------------------------------------------------------------------------- */
/* Normalisers                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Normalise a Kenyan phone number to E.164 (`2547XXXXXXXX`).
 *
 * This MUST produce byte-identical output to `normalizePhone` in
 * lib/mpesa/daraja.ts:249-255 — otherwise a blind index computed on the write
 * path will not match one computed on the lookup path. The recommended change
 * is to make lib/mpesa/daraja.ts import this function, so there is exactly one
 * implementation. (That edit is outside the scope of the encryption-core
 * change set; see the integration checklist in the deliverable.)
 */
export function normalizePhoneE164(input: string): string {
  const trimmed = (input || "").replace(/\s+/g, "").replace(/^\+/, "")
  if (/^254\d{9}$/.test(trimmed)) return trimmed
  if (/^0\d{9}$/.test(trimmed)) return "254" + trimmed.slice(1)
  if (/^\d{9}$/.test(trimmed)) return "254" + trimmed
  return trimmed
}

/** Normalise an email for blind indexing (lowercase, trimmed). */
export function normalizeEmail(input: string): string {
  return (input || "").trim().toLowerCase()
}

/** The normaliser function for a spec, or `undefined` for none. */
export function normalizerFor(spec: PiiColumnSpec): ((value: string) => string) | undefined {
  if (spec.normalize === "phone-e164") return normalizePhoneE164
  if (spec.normalize === "email") return normalizeEmail
  return undefined
}

/** The blind-index kind of a column ("none" when it has no blind index). */
export function blindIndexKindFor(spec: PiiColumnSpec): BlindIndexKind | "none" {
  return spec.normalize ?? "none"
}

/** Every protected column of a table (i.e. everything except `plaintext`). */
export function specsForTable(table: string): PiiColumnSpec[] {
  return PII_COLUMNS.filter((spec) => spec.table === table && spec.mode !== "plaintext")
}

/** The blind-index sibling column of a table/column pair, if any. */
export function blindIndexColumnFor(table: string, column: string): string | undefined {
  const spec = PII_COLUMNS.find(
    (s) => s.table === table && s.column === column && s.blindIndexColumn,
  )
  return spec?.blindIndexColumn
}

/**
 * Compute the blind index of a plaintext value for a spec.
 * Returns `null` when the spec has no blind index.
 */
export function blindIndexForSpec(spec: PiiColumnSpec, plaintext: string): string | null {
  if (!spec.blindIndexColumn) return null
  return blindIndex(plaintext, { normalize: normalizerFor(spec) })
}

/* -------------------------------------------------------------------------- */
/* Row helpers                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * A non-enumerable marker attached to a decrypted row when it still holds
 * legacy plaintext values or ciphertext under a retired key id.
 */
export const PII_MIGRATION_FLAG = Symbol.for("propdesk.pii.migrationReport")

export interface PiiMigrationReport {
  /** Columns that still hold a legacy plaintext value (need the backfill). */
  needsMigration: string[]
  /** Columns whose ciphertext is not under the active key id (need rotation). */
  needsRotation: string[]
}

/**
 * Encrypt every protected column of a row, in place, and refresh the blind
 * index columns. Returns the same object.
 *
 * IDEMPOTENT: a value that is already an envelope is left exactly as it is
 * (it is not re-encrypted, so a double-encrypt cannot happen), and only a
 * missing blind index is filled in.
 *
 * Empty strings are left alone — "no value" must stay distinguishable from
 * "an encrypted empty string" for the UI.
 */
export function encryptRow<T extends Record<string, unknown>>(table: string, row: T): T {
  const target = row as Record<string, unknown>
  for (const spec of specsForTable(table)) {
    const current = target[spec.column]
    if (typeof current !== "string" || current === "") continue

    if (isEncryptedField(current)) {
      // Already encrypted: leave the ciphertext alone, but make sure the
      // sibling blind index exists (self-healing after a partial backfill).
      if (spec.mode === "blind-index" && spec.blindIndexColumn) {
        const existing = target[spec.blindIndexColumn]
        if (typeof existing !== "string" || existing === "") {
          const plaintext = decryptField(current, { context: spec.context })
          const idx = blindIndexForSpec(spec, plaintext as string)
          if (idx) target[spec.blindIndexColumn] = idx
        }
      }
      continue
    }

    target[spec.column] = encryptField(current, { context: spec.context })

    if (spec.mode === "blind-index" && spec.blindIndexColumn) {
      const idx = blindIndexForSpec(spec, current)
      if (idx) target[spec.blindIndexColumn] = idx
    }
  }
  return row
}

/**
 * Decrypt every protected column of a row, in place. The blind index columns
 * are left untouched (they are not secret — they are the index).
 *
 * BACKWARD COMPATIBLE: a legacy plaintext value is returned unchanged and
 * does NOT throw, so a half-migrated table keeps working during the migration
 * window. Such a row is flagged — see `decryptRowWithReport()` and the
 * non-enumerable `PII_MIGRATION_FLAG` property.
 *
 * A tampered ciphertext DOES throw: that is a corrupted or tampered row and
 * must never be silently returned as garbage. A value that carries a
 * registered key id but does not parse as a well-formed envelope is a CORRUPT
 * row and throws too — it is never reported as "needs migration", because
 * encrypting the corruption would make it permanent.
 */
export function decryptRow<T extends Record<string, unknown>>(table: string, row: T): T {
  const { report } = decryptRowWithReport(table, row)
  if (report.needsMigration.length > 0 || report.needsRotation.length > 0) {
    Object.defineProperty(row as object, PII_MIGRATION_FLAG, {
      value: report,
      enumerable: false,
      configurable: true,
      writable: true,
    })
  }
  return row
}

/**
 * Decrypt a row and report what still needs work:
 *   - `needsMigration` — columns that hold a legacy plaintext value;
 *   - `needsRotation`   — columns whose ciphertext is under a retired key id.
 */
export function decryptRowWithReport<T extends Record<string, unknown>>(
  table: string,
  row: T,
): { row: T; report: PiiMigrationReport } {
  const target = row as Record<string, unknown>
  const report: PiiMigrationReport = { needsMigration: [], needsRotation: [] }

  let activeKeyId: string | null = null
  try {
    activeKeyId = getKeyRegistry().activeKeyId
  } catch {
    // No key configured: the row cannot be decrypted at all. Leave it alone;
    // the caller (or the health check) reports the missing configuration.
    activeKeyId = null
  }

  for (const spec of specsForTable(table)) {
    const current = target[spec.column]
    if (typeof current !== "string" || current === "") continue

    if (!isEncryptedField(current)) {
      // A value that carries a registered key id but does not parse is a
      // CORRUPT row, not legacy plaintext. It must not be handed back as
      // data, and it must not be reported as "needs migration" — the
      // migration would encrypt the corruption and make it permanent.
      if (isCorruptEnvelope(current)) {
        throw new FieldEncryptionError(
          `Corrupt encrypted value in ${table}.${spec.column}: it carries a registered key id ` +
            `but is not a well-formed envelope. The row must be restored from a known-good copy ` +
            `before it can be read.`,
        )
      }
      // Legacy plaintext — read it back unchanged, but flag it.
      report.needsMigration.push(spec.column)
      continue
    }

    target[spec.column] = decryptField(current, { context: spec.context })

    const keyId = getEnvelopeKeyId(current)
    if (activeKeyId && keyId && keyId !== activeKeyId) {
      report.needsRotation.push(spec.column)
    }
  }

  return { row, report }
}

/**
 * Decrypt a row and report which columns would be re-encrypted under the
 * active key. Used by the rotation job (design §13.2).
 */
export function rotationPlanForRow<T extends Record<string, unknown>>(
  table: string,
  row: T,
): Array<{ column: string; reencrypted: string }> {
  const out: Array<{ column: string; reencrypted: string }> = []
  for (const spec of specsForTable(table)) {
    const current = row[spec.column]
    if (typeof current !== "string" || current === "") continue
    const res = decryptFieldWithRotation(current, { context: spec.context })
    if (res && res.reencrypted) out.push({ column: spec.column, reencrypted: res.reencrypted })
  }
  return out
}

/**
 * The migration report attached to a row by `decryptRow()`, if any.
 */
export function migrationReportFor<T extends Record<string, unknown>>(
  row: T,
): PiiMigrationReport | undefined {
  return (row as Record<symbol, unknown>)[PII_MIGRATION_FLAG] as PiiMigrationReport | undefined
}
