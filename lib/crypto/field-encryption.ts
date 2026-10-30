/**
 * lib/crypto/field-encryption.ts
 *
 * Application-layer encryption at rest for PropDesk Africa.
 *
 * WHAT THIS IS
 *   A thin, dependency-free wrapper around Node's built-in `node:crypto` that
 *   encrypts individual database columns with AES-256-GCM (authenticated
 *   encryption) and produces a single self-describing string:
 *
 *       v1:<iv-b64>:<authTag-b64>:<ciphertext-b64>
 *
 *   The `v1` prefix is BOTH the envelope version AND the key id. Rotating the
 *   key means registering a new key id (e.g. `v2`); new ciphertexts are then
 *   written as `v2:...` while old `v1:...` ciphertexts keep decrypting with the
 *   retired-but-still-registered key. See audit/design/encryption-design.md §5.
 *
 * RUNTIME
 *   Node.js only. This module imports `node:crypto`, so any route handler that
 *   imports it must run on the Node.js runtime:
 *
 *       export const runtime = "nodejs"
 *
 *   Never import this from a `"use client"` module and never send the key, the
 *   registry or a raw envelope to the browser.
 *
 * KEY MATERIAL
 *   - `PROPDESK_ENCRYPTION_KEYS`  JSON registry  { "v1": "<base64 32 bytes>" }
 *   - `PROPDESK_ENCRYPTION_KEY`   single-key shorthand (equivalent to {"v1": …})
 *   - `PROPDESK_BLIND_INDEX_KEYS` JSON registry  { "b1": "<base64 32 bytes>" }
 *   - `PROPDESK_BLIND_INDEX_KEY`  single-key shorthand (equivalent to {"b1": …})
 *
 *   Keys are read from the environment only. They are never hardcoded, never
 *   logged, never returned to a client and never written to the database.
 *
 * BACKWARD COMPATIBILITY
 *   Columns may hold either an envelope or a legacy plaintext value. Every
 *   decrypt function passes a non-envelope value through unchanged, so a
 *   partially-migrated table keeps working. `decryptFieldStrict` is the
 *   opposite: it throws, and is used by the backfill script.
 *
 * SOURCE OF TRUTH
 *   audit/design/encryption-design.md §5 (envelope), §6 (this file) and §10.2
 *   (constant-time comparison).
 */

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto"

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

export const ENVELOPE_VERSION = "v1"
export const CIPHER_ALGORITHM = "aes-256-gcm"
/** GCM nonce length in bytes. 96 bits is the value NIST SP 800-38D recommends. */
export const IV_LENGTH = 12
/** GCM authentication tag length in bytes. 16 bytes = 128 bits. */
export const AUTH_TAG_LENGTH = 16
/** AES-256 key length in bytes. */
export const KEY_LENGTH = 32
/** Default key id used for the single-key env-var shorthands. */
export const DEFAULT_BLIND_INDEX_KEY_ID = "b1"

/* -------------------------------------------------------------------------- */
/* Errors                                                                      */
/* -------------------------------------------------------------------------- */

export class FieldEncryptionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "FieldEncryptionError"
  }
}

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export interface KeyRegistry {
  /** Key id used for every NEW ciphertext. */
  activeKeyId: string
  /** keyId -> 32-byte AES key. */
  encryptionKeys: Map<string, Buffer>
  /** keyId -> 32-byte HMAC key. May be empty if blind indexes are unused. */
  blindIndexKeys: Map<string, Buffer>
  /** Blind-index key id used for every NEW blind index. */
  activeBlindIndexKeyId: string
}

export interface FieldOptions {
  /**
   * Optional additional authenticated data. When set, the same string MUST be
   * passed when decrypting, or the authentication tag will not verify.
   *
   * Use the column's stable identity, e.g. "tenants.national_id". This stops a
   * ciphertext being moved between columns (a phone number pasted into the
   * national-id column will fail to authenticate).
   */
  context?: string
}

export interface BlindIndexOptions {
  /** Normaliser applied to the value before hashing, e.g. E.164 phone. */
  normalize?: (value: string) => string
  /** Force a specific blind-index key id. Defaults to the active one. */
  keyId?: string
  /**
   * Extra literal forms of the value to index, e.g. "0712345678",
   * "254712345678", "+254712345678", "712345678".
   *
   * Each variant is indexed VERBATIM — the `normalize` function is not applied
   * to it — so a lookup can still match a row that was indexed before the
   * normaliser existed. `normalize` is applied to the original value only, and
   * that result is added to the candidate set as well.
   */
  variants?: string[]
}

export interface DecryptResult {
  /** The decrypted value. */
  plaintext: string
  /** The key id the ciphertext was encrypted under. Empty for legacy plaintext. */
  keyId: string
  /**
   * The value re-encrypted under the active key, or `null` when the stored
   * value is already current. Write this back to complete a rotation.
   */
  reencrypted: string | null
}

/* -------------------------------------------------------------------------- */
/* Key registry                                                                */
/* -------------------------------------------------------------------------- */

let cachedRegistry: KeyRegistry | null = null

/**
 * Reset the memoised registry. Test-only — and the only supported way to
 * rebuild the registry after `process.env` changed.
 */
export function resetKeyRegistry(): void {
  cachedRegistry = null
}

/**
 * True when at least one encryption key is configured. Use it for a startup
 * health check only — a missing key must FAIL CLOSED (writes throw), never
 * silently fall back to storing plaintext.
 */
export function isFieldEncryptionConfigured(): boolean {
  try {
    getKeyRegistry()
    return true
  } catch {
    return false
  }
}

/**
 * Load (and memoise) the key registry from the environment.
 *
 * Throws `FieldEncryptionError` when no encryption key is configured, when a
 * key is not exactly 32 bytes, or when the registry is malformed.
 */
export function getKeyRegistry(): KeyRegistry {
  if (cachedRegistry) return cachedRegistry

  const encryptionKeys = parseKeyMap(process.env.PROPDESK_ENCRYPTION_KEYS, "PROPDESK_ENCRYPTION_KEYS")

  const singleKey = process.env.PROPDESK_ENCRYPTION_KEY
  if (encryptionKeys.size === 0 && singleKey && singleKey.trim() !== "") {
    encryptionKeys.set(ENVELOPE_VERSION, decodeKey(singleKey, "PROPDESK_ENCRYPTION_KEY"))
  }
  if (encryptionKeys.size === 0) {
    throw new FieldEncryptionError(
      "No encryption key configured. Set PROPDESK_ENCRYPTION_KEYS to a JSON object " +
        'such as { "v1": "<base64 of 32 random bytes>" } (generate with: openssl rand -base64 32).',
    )
  }

  const blindIndexKeys = parseKeyMap(process.env.PROPDESK_BLIND_INDEX_KEYS, "PROPDESK_BLIND_INDEX_KEYS")
  const singleBlindKey = process.env.PROPDESK_BLIND_INDEX_KEY
  if (blindIndexKeys.size === 0 && singleBlindKey && singleBlindKey.trim() !== "") {
    blindIndexKeys.set(DEFAULT_BLIND_INDEX_KEY_ID, decodeKey(singleBlindKey, "PROPDESK_BLIND_INDEX_KEY"))
  }

  // The blind-index key MUST be different from the encryption key. Reusing
  // one key for both purposes breaks the security properties of both: the
  // blind index would be computable from the encryption key, so anyone who
  // could decrypt a column could also confirm a guess of a phone number
  // without the database — and an HMAC key used for GCM is a key used for
  // two primitives. Fail loudly rather than accept it silently.
  const activeBlindKeyId = blindIndexKeys.size > 0 ? pickActiveKeyId(blindIndexKeys.keys()) : DEFAULT_BLIND_INDEX_KEY_ID
  const activeEncryptionKey = encryptionKeys.get(pickActiveKeyId(encryptionKeys.keys()))
  const activeBlindKey = blindIndexKeys.get(activeBlindKeyId)
  if (activeEncryptionKey && activeBlindKey && activeEncryptionKey.equals(activeBlindKey)) {
    throw new FieldEncryptionError(
      "The blind-index key and the encryption key are the same key material. " +
        "They MUST be different values — generate two separate keys " +
        "(openssl rand -base64 32) and set PROPDESK_ENCRYPTION_KEYS and " +
        "PROPDESK_BLIND_INDEX_KEYS to them separately.",
    )
  }

  cachedRegistry = {
    activeKeyId: pickActiveKeyId(encryptionKeys.keys()),
    encryptionKeys,
    blindIndexKeys,
    activeBlindIndexKeyId:
      blindIndexKeys.size > 0 ? pickActiveKeyId(blindIndexKeys.keys()) : DEFAULT_BLIND_INDEX_KEY_ID,
  }

  return cachedRegistry
}

/**
 * Parse a key registry from an env var.
 *
 * Accepted formats:
 *   JSON   {"v1":"<base64>","v2":"<base64>"}
 *   CSV    v1=<base64>,v2=<base64>
 */
function parseKeyMap(raw: string | undefined, label: string): Map<string, Buffer> {
  const out = new Map<string, Buffer>()
  if (!raw || raw.trim() === "") return out

  const trimmed = raw.trim()
  let entries: Array<[string, string]>

  if (trimmed.startsWith("{")) {
    let parsed: unknown
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      throw new FieldEncryptionError(`${label} is not valid JSON.`)
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new FieldEncryptionError(`${label} must be a JSON object of { "keyId": "<base64>" }.`)
    }
    entries = Object.entries(parsed as Record<string, string>)
  } else {
    entries = trimmed.split(",").map((pair) => {
      const idx = pair.indexOf("=")
      if (idx <= 0) {
        throw new FieldEncryptionError(`${label} entries must look like "keyId=<base64>".`)
      }
      return [pair.slice(0, idx).trim(), pair.slice(idx + 1).trim()] as [string, string]
    })
  }

  for (const [id, b64] of entries) {
    if (!KEY_ID_RE.test(id)) {
      throw new FieldEncryptionError(`${label} has an invalid key id "${id}".`)
    }
    if (typeof b64 !== "string") {
      throw new FieldEncryptionError(`${label}[${id}] must be a base64 string.`)
    }
    out.set(id, decodeKey(b64, `${label}[${id}]`))
  }
  return out
}

const KEY_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/

function decodeKey(b64: string, label: string): Buffer {
  const key = Buffer.from(b64.trim(), "base64")
  if (key.length !== KEY_LENGTH) {
    throw new FieldEncryptionError(
      `${label} must decode to exactly ${KEY_LENGTH} bytes (base64 of 32 random bytes); got ${key.length}. ` +
        "Generate one with: openssl rand -base64 32",
    )
  }
  return key
}

/**
 * Pick the "newest" key id from a set, comparing the numeric suffix
 * naturally so v10 sorts after v9.
 */
function pickActiveKeyId(ids: Iterable<string>): string {
  let best: string | null = null
  for (const id of ids) {
    if (best === null || compareKeyIds(id, best) > 0) best = id
  }
  if (best === null) throw new FieldEncryptionError("Key registry is empty.")
  return best
}

function compareKeyIds(a: string, b: string): number {
  const ax = a.match(/(\d+)|(\D+)/g) ?? []
  const bx = b.match(/(\d+)|(\D+)/g) ?? []
  const len = Math.min(ax.length, bx.length)
  for (let i = 0; i < len; i++) {
    const an = ax[i]
    const bn = bx[i]
    const aNum = /^\d+$/.test(an)
    const bNum = /^\d+$/.test(bn)
    if (aNum && bNum) {
      const diff = Number(an) - Number(bn)
      if (diff !== 0) return diff < 0 ? -1 : 1
    } else if (an !== bn) {
      return an < bn ? -1 : 1
    }
  }
  return ax.length - bx.length
}

/* -------------------------------------------------------------------------- */
/* Envelope encoding / decoding                                                */
/* -------------------------------------------------------------------------- */

interface ParsedEnvelope {
  keyId: string
  iv: Buffer
  authTag: Buffer
  ciphertext: Buffer
}

/**
 * Parse an envelope. Returns `null` when the string is not a well-formed
 * envelope (i.e. it is legacy plaintext).
 *
 * The format is unambiguous: exactly four colon-separated segments, and the
 * standard base64 alphabet (A-Z a-z 0-9 + / plus up to two trailing `=`) never
 * contains a colon, so `split(":")` cannot be confused by the payload.
 */
function parseEnvelope(payload: string): ParsedEnvelope | null {
  const parts = payload.split(":")
  if (parts.length !== 4) return null

  const keyId = parts[0]
  const ivB64 = parts[1]
  const tagB64 = parts[2]
  const ctB64 = parts[3]

  if (!KEY_ID_RE.test(keyId)) return null
  if (!BASE64_RE.test(ivB64) || !BASE64_RE.test(tagB64) || !BASE64_RE.test(ctB64)) return null

  const iv = Buffer.from(ivB64, "base64")
  const authTag = Buffer.from(tagB64, "base64")
  const ciphertext = Buffer.from(ctB64, "base64")

  if (iv.length !== IV_LENGTH) return null
  if (authTag.length !== AUTH_TAG_LENGTH) return null

  return { keyId, iv, authTag, ciphertext }
}

const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/

/**
 * True when the payload starts with `<registered-key-id>:`.
 *
 * This is the discriminator between "legacy plaintext" and "a corrupt
 * envelope". A legacy plaintext value has no key-id prefix — a phone number, a
 * name, a national id. An encrypted value always starts with the key id it was
 * written under, so a value that carries a registered key id and a colon is
 * meant to be an envelope and must be parsed as one.
 *
 * The key id is looked up in the registry rather than matched by pattern, so
 * a genuine plaintext value that happens to contain a colon (a timestamp, a
 * URL) is not mistaken for an envelope.
 */
function hasRegisteredKeyPrefix(payload: string): boolean {
  const sep = payload.indexOf(":")
  if (sep <= 0) return false
  const keyId = payload.slice(0, sep)
  if (!KEY_ID_RE.test(keyId)) return false
  return getKeyRegistry().encryptionKeys.has(keyId)
}

/**
 * True when the value looks like an envelope produced by `encryptField`.
 *
 * A legacy plaintext value returns `false` — that is how the backfill and the
 * row helpers tell "already migrated" from "still plaintext".
 */
export function isEncryptedField(value: string | null | undefined): boolean {
  if (!value) return false
  return parseEnvelope(value) !== null
}

/**
 * True when the value LOOKS like an encrypted envelope (it carries a
 * registered key id and a colon) but is not one — a truncated row, a value
 * whose base64 was mangled, a ciphertext written with a different envelope
 * layout.
 *
 * Such a value is neither usable ciphertext nor legacy plaintext. It must
 * never be served as if it were data.
 */
export function isCorruptEnvelope(value: string | null | undefined): boolean {
  if (!value) return false
  if (parseEnvelope(value) !== null) return false
  return hasRegisteredKeyPrefix(value)
}

/**
 * The key id an envelope was encrypted under, or `null` for legacy plaintext.
 */
export function getEnvelopeKeyId(value: string | null | undefined): string | null {
  if (!value) return null
  const parsed = parseEnvelope(value)
  return parsed ? parsed.keyId : null
}

/* -------------------------------------------------------------------------- */
/* Encrypt / decrypt                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Encrypt a value.
 *
 * - `null` / `undefined` stay `null` so "no value" is distinguishable from
 *   "empty string".
 * - A fresh random 96-bit IV is generated for every call; the same plaintext
 *   encrypts to a different ciphertext every time (randomised mode).
 * - The IV, the 128-bit GCM auth tag and the ciphertext are returned as one
 *   base64 string with the key id as the version prefix.
 */
export function encryptField(plaintext: string, opts?: FieldOptions): string
export function encryptField(plaintext: null | undefined, opts?: FieldOptions): null
export function encryptField(plaintext: string | null | undefined, opts?: FieldOptions): string | null
export function encryptField(
  plaintext: string | null | undefined,
  opts: FieldOptions = {},
): string | null {
  if (plaintext === null || plaintext === undefined) return null

  const registry = getKeyRegistry()
  const keyId = registry.activeKeyId
  const key = registry.encryptionKeys.get(keyId)
  if (!key) {
    throw new FieldEncryptionError(`Active key "${keyId}" is not present in the key registry.`)
  }

  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(CIPHER_ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  if (opts.context) cipher.setAAD(Buffer.from(opts.context, "utf8"))

  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [
    keyId,
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":")
}

/**
 * Decrypt a value.
 *
 * Legacy plaintext (anything that is not a well-formed envelope) is returned
 * unchanged, so a half-migrated table keeps working.
 *
 * Throws `FieldEncryptionError` when the key id is not in the registry or when
 * the authentication tag does not verify (wrong key, wrong `context`, or the
 * ciphertext was tampered with).
 */
export function decryptField(payload: string, opts?: FieldOptions): string
export function decryptField(payload: null | undefined, opts?: FieldOptions): null
export function decryptField(payload: string | null | undefined, opts?: FieldOptions): string | null
export function decryptField(
  payload: string | null | undefined,
  opts: FieldOptions = {},
): string | null {
  if (payload === null || payload === undefined) return null

  const parsed = parseEnvelope(payload)
  if (!parsed) {
    // A value that carries a REGISTERED key id and a colon is meant to be an
    // envelope. If it does not parse, it is a corrupt or truncated row — not
    // legacy plaintext — and it must not be handed back as if it were data.
    // (An unknown key id already fails closed below, so this rule makes the
    // two paths consistent.)
    if (hasRegisteredKeyPrefix(payload)) {
      throw new FieldEncryptionError(
        "Corrupt or truncated encrypted value: it carries a registered key id but is not a " +
          "well-formed envelope (expected <keyId>:<iv>:<authTag>:<ciphertext>). The row must be " +
          "re-encrypted from a known-good copy.",
      )
    }
    // Genuine legacy plaintext: pass it through unchanged so a half-migrated
    // table keeps working during the migration window.
    return payload
  }

  const key = getKeyRegistry().encryptionKeys.get(parsed.keyId)
  if (!key) {
    throw new FieldEncryptionError(
      `Unknown encryption key id "${parsed.keyId}". Register the key in PROPDESK_ENCRYPTION_KEYS before reading this row.`,
    )
  }

  const decipher = createDecipheriv(CIPHER_ALGORITHM, key, parsed.iv, { authTagLength: AUTH_TAG_LENGTH })
  if (opts.context) decipher.setAAD(Buffer.from(opts.context, "utf8"))
  decipher.setAuthTag(parsed.authTag)

  try {
    return Buffer.concat([decipher.update(parsed.ciphertext), decipher.final()]).toString("utf8")
  } catch {
    throw new FieldEncryptionError(
      "Failed to decrypt field: the authentication tag did not verify. " +
        "The key, the context or the stored ciphertext is wrong.",
    )
  }
}

/**
 * Decrypt a value and report what it should be re-encrypted to.
 *
 * This is the "decrypt-then-re-encrypt" step of a key rotation:
 *
 *   const res = decryptFieldWithRotation(row.tenants_national_id, { context: "tenants.national_id" })
 *   if (res?.reencrypted) await sql`UPDATE tenants SET national_id = ${res.reencrypted} WHERE id = ${id}`
 */
export function decryptFieldWithRotation(payload: string, opts?: FieldOptions): DecryptResult
export function decryptFieldWithRotation(
  payload: null | undefined,
  opts?: FieldOptions,
): null
export function decryptFieldWithRotation(
  payload: string | null | undefined,
  opts?: FieldOptions,
): DecryptResult | null
export function decryptFieldWithRotation(
  payload: string | null | undefined,
  opts: FieldOptions = {},
): DecryptResult | null {
  if (payload === null || payload === undefined) return null

  const parsed = parseEnvelope(payload)
  if (!parsed) {
    // Legacy plaintext: decrypt is a no-op, but it still needs encrypting.
    // A corrupt envelope is caught by decryptField below and thrown — it must
    // never be re-encrypted as if it were plaintext.
    if (hasRegisteredKeyPrefix(payload)) {
      decryptField(payload, opts) // throws
    }
    return { plaintext: payload, keyId: "", reencrypted: encryptField(payload, opts) }
  }

  const registry = getKeyRegistry()
  const plaintext = decryptField(payload, opts) as string
  if (parsed.keyId === registry.activeKeyId) {
    return { plaintext, keyId: parsed.keyId, reencrypted: null }
  }
  return { plaintext, keyId: parsed.keyId, reencrypted: encryptField(plaintext, opts) }
}

/**
 * Like `decryptField`, but throws when the value is not an envelope.
 * Used by the backfill script to detect legacy plaintext rows.
 */
export function decryptFieldStrict(payload: string, opts?: FieldOptions): string
export function decryptFieldStrict(payload: null | undefined, opts?: FieldOptions): null
export function decryptFieldStrict(
  payload: string | null | undefined,
  opts?: FieldOptions,
): string | null
export function decryptFieldStrict(
  payload: string | null | undefined,
  opts: FieldOptions = {},
): string | null {
  if (payload === null || payload === undefined) return null
  if (!parseEnvelope(payload)) {
    throw new FieldEncryptionError("Value is not an encrypted envelope.")
  }
  return decryptField(payload, opts)
}

/* -------------------------------------------------------------------------- */
/* Blind index                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Compute a blind index: an HMAC-SHA256 of the (normalised) value under a
 * SEPARATE key, rendered as `<keyId>:<hex>`.
 *
 * A blind index is deterministic — the same input always yields the same
 * output — so it can be used in a SQL `WHERE` clause, while revealing nothing
 * about the plaintext without the blind-index key.
 */
export function blindIndex(value: string, opts?: BlindIndexOptions): string
export function blindIndex(value: null | undefined, opts?: BlindIndexOptions): null
export function blindIndex(
  value: string | null | undefined,
  opts: BlindIndexOptions = {},
): string | null {
  if (value === null || value === undefined) return null

  const registry = getKeyRegistry()
  const keyId = opts.keyId ?? registry.activeBlindIndexKeyId
  const key = registry.blindIndexKeys.get(keyId)
  if (!key) {
    throw new FieldEncryptionError(
      "No blind-index key configured. Set PROPDESK_BLIND_INDEX_KEYS to a JSON object " +
        'such as { "b1": "<base64 of 32 random bytes>" } (generate with: openssl rand -base64 32).',
    )
  }

  const normalised = opts.normalize ? opts.normalize(value) : value
  const trimmed = normalised.trim().toLowerCase()
  const mac = createHmac("sha256", key).update(trimmed, "utf8").digest("hex")
  return `${keyId}:${mac}`
}

/**
 * Every blind-index value that could match the given input.
 *
 * Two dimensions are covered:
 *
 *   1. The VALUE FORMS. A Kenyan phone number can be written `0712345678`,
 *      `254712345678`, `+254712345678` or `712345678`. The blind index of the
 *      canonical E.164 form (`254712345678`) is what the write path stores, so
 *      a lookup has to try every form it might have been given. The forms are
 *      indexed VERBATIM (the `normalize` function is not applied to them) so
 *      rows indexed before the normaliser existed still match.
 *   2. The KEY IDS. One candidate per registered blind-index key, so a
 *      blind-index key rotation can run both keys side by side:
 *      `WHERE phone_blind_index = ANY($1)`.
 *
 * The result is de-duplicated. For a value that is not phone-shaped there is
 * exactly one variant, so the function returns one candidate per registered
 * key — the behaviour described in the design (§9.3).
 */
export function blindIndexCandidates(value: string, opts?: BlindIndexOptions): string[]
export function blindIndexCandidates(
  value: null | undefined,
  opts?: BlindIndexOptions,
): string[]
export function blindIndexCandidates(
  value: string | null | undefined,
  opts: BlindIndexOptions = {},
): string[] {
  if (value === null || value === undefined) return []

  const registry = getKeyRegistry()
  const ids = opts.keyId ? [opts.keyId] : [...registry.blindIndexKeys.keys()]
  if (ids.length === 0) return []

  const variants = opts.variants && opts.variants.length > 0
    ? dedupe(opts.variants)
    : phoneLookupForms(value)

  // The canonical (normalised) form of the original value is always a
  // candidate, because that is what the write path stores.
  if (opts.normalize) {
    const canonical = opts.normalize(value)
    if (canonical) variants.push(canonical)
  }

  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    for (const variant of variants) {
      const idx = blindIndex(variant, { keyId: id })
      if (!idx || seen.has(idx)) continue
      seen.add(idx)
      out.push(idx)
    }
  }
  return out
}

/**
 * The literal forms a Kenyan phone number may have been written in:
 * `254712345678`, `+254712345678`, `0712345678` and `712345678`.
 *
 * The set depends only on the NUMBER, not on the punctuation of the input, so
 * `blindIndexCandidates("0712345678")` and
 * `blindIndexCandidates("+254712345678")` return the same candidates.
 *
 * Returns the value itself for anything that is not phone-shaped.
 */
export function phoneLookupForms(input: string): string[] {
  const raw = (input || "").trim()
  if (!raw) return []

  const digits = raw.replace(/\s+/g, "").replace(/^\+/, "")
  if (!/^\d{9,12}$/.test(digits)) return [raw]

  // The nine-digit local number, whatever form the input came in.
  let local = ""
  if (digits.length === 9) local = digits
  else if (digits.length === 10 && digits.startsWith("0")) local = digits.slice(1)
  else if (digits.length === 12 && digits.startsWith("254")) local = digits.slice(3)
  else return [raw]

  return dedupe([
    "254" + local,    // 254712345678  (E.164 — what the write path stores)
    "+254" + local,   // +254712345678
    "0" + local,      // 0712345678
    local,            // 712345678
  ])
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    if (!value || seen.has(value)) continue
    seen.add(value)
    out.push(value)
  }
  return out
}

/* -------------------------------------------------------------------------- */
/* Secret comparison                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Constant-time comparison of two secrets.
 *
 * Both sides are hashed with SHA-256 first, so:
 *   - the compared buffers are always exactly 32 bytes, which means
 *     `timingSafeEqual` can never throw on a length mismatch;
 *   - the length of the expected secret is not observable;
 *   - the `.length` code-unit vs. byte mismatch disappears.
 *
 * Use this for CRON_SECRET, MIGRATION_SECRET, BACKUP_CRON_SECRET and
 * MPESA_CALLBACK_SECRET. Do NOT use `===` for secrets.
 */
export function timingSafeEqualString(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false
  const da = createHash("sha256").update(a, "utf8").digest()
  const db = createHash("sha256").update(b, "utf8").digest()
  return timingSafeEqual(da, db)
}
