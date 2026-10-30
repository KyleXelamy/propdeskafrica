# PropDesk Africa — Encryption at Rest, Key Management & Data Protection

**Implementation specification.** This is the build guide for the cycle that follows
`audit/findings/crypto.md` (25 findings, CRYPTO-001 … CRYPTO-025).

**Status:** design only. Nothing in this document has been applied to the application source.

**Audience:** the engineer implementing the cycle. Every step below is executable without further
questions. Where a decision had to be made, the reasoning is given so it can be overridden
deliberately rather than by accident.

---

## 0. What to build, in one page

| # | Deliverable | Fixes |
|---|---|---|
| 1 | `lib/crypto/field-encryption.ts` — AES-256-GCM field encryption, key registry, blind index, constant-time secret compare | CRYPTO-007, 008, 009, 010, 011 |
| 2 | `lib/crypto/pii-columns.ts` — the per-column plan as code + row helpers | CRYPTO-001…004, 021, 022 |
| 3 | `db/migrations/003-pii-encryption.sql` — blind-index columns + indexes | CRYPTO-002, 021 |
| 4 | Server-side read/write changes on every PII path | CRYPTO-001…004, 021, 025 |
| 5 | `scripts/backfill-encryption.ts` — idempotent, dry-run capable | CRYPTO-001…004, 021 |
| 6 | `lib/crypto/rotation.ts` + `POST /api/cron/rotate-keys` | CRYPTO-007 |
| 7 | Storage bucket + policy changes, signed URLs | CRYPTO-005, 006 |
| 8 | `DELETE /api/account` + tenant-redaction sweep | CRYPTO-012, 013, 020 |
| 9 | `data_access_audit` table + write path | CRYPTO-015 |
| 10 | Legal-page corrections | CRYPTO-016…020 |

**The one thing that must happen first:** the dashboard currently reads sensitive columns **straight
from the browser** (`app/dashboard/tenants/[id]/page.tsx:27-36` and 20 other files, CRYPTO-025).
The browser cannot decrypt an envelope, so until those reads are proxied through the server,
encrypting `tenants.national_id` will simply render `v1:…` in the UI. Phase 0 (§11.1) exists for
this reason and blocks everything else.

---

## 1. Scope, goals, non-goals

### Goals

1. Sensitive PII is unreadable in the database, in the backups, in the CSV/JSON exports and in any
   dump, without the application key.
2. A stolen database credential, a leaked `DATABASE_URL`, an over-broad SQL grant or a careless
   `select *` does not yield national ID numbers, phone numbers, M-Pesa MSISDNs or payer names.
3. The key can be rotated without downtime and without a schema change, and a row written under an
   old key is transparently re-encrypted.
4. Lookups that the product genuinely needs (find a tenant by phone, find a landlord by paybill
   number) keep working, without giving up randomised encryption of the value itself.
5. Every secret comparison in the app is constant-time and length-oracle-free.
6. Identity documents are served from private buckets over short-lived signed URLs.
7. A user can actually delete their data, and the app records who read what.

### Non-goals

* **We are not replacing the platform's disk encryption.** Neon and Supabase both encrypt volumes at
  rest. Application-layer encryption is *defence in depth*: it survives the loss of a database
  credential, which disk encryption does not.
* **We are not encrypting free-text columns** (`notes.content`, `documents.notes`, …). Column-wise
  encryption would break search and the editors, and a blob of ciphertext is not a policy. See §8.
* **We are not changing the password scheme.** Supabase Auth hashes passwords with bcrypt; the
  application never sees a password (`lib/actions.ts:26-29`, `:70-76`,
  `app/(marketing)/auth/reset-password/form.tsx:57`). Do not introduce an application-side password
  layer.
* **We are not implementing an OTP system.** There is none today: no code column, no code table, no
  code comparison anywhere in `app/**` or `lib/**`. `components/ui/input-otp.tsx` is a shadcn input
  component with no backend counterpart. If one is added later it must store only an HMAC of the code
  plus an expiry, never the code itself.
* **We are not doing per-tenant key derivation in this cycle.** It is designed for (§13.3) but the
  single-tenant-per-workspace model in PropDesk means the value is bounded today.

---

## 2. Threat model

| Threat | Control in this design |
|---|---|
| Leaked `DATABASE_URL` / Neon credential → `select *` | Field encryption (AES-256-GCM) + blind index for the few searchable fields |
| Read-only DB role with broad SELECT | Same — ciphertext only |
| `backups.payload` jsonb / the `backups` bucket | §12.4 — the payload is encrypted before it is persisted |
| SQL injection reading another tenant's row | Ciphertext is useless without the key; row-level scoping is fixed in CRYPTO-016/023/025 |
| Insider with production DB access | Same, plus §14 — every read of a sensitive column is audited |
| Insider with production **app** access | §14 — reads are attributed to a user id, not to "the app" |
| Stolen `SUPABASE_SERVICE_ROLE_KEY` | Reads the ciphertext, not the plaintext. Does **not** help against a stolen *encryption* key — which is why the two are rotated separately (§13) |
| Leaked `STRIPE_SECRET_KEY` / `MPESA_CONSUMER_SECRET` | Not in scope here, but §10.1 replaces the app's own `===` secret comparisons with constant-time ones |
| Stolen backup file from the `backups` bucket | §12.4 |
| Public URL for an identity document | §12 — private buckets + signed URLs |

**Explicitly out of scope:** SQL injection in general, auth bypass, RLS deployment on Neon
(CRYPTO-016 option (b)), a full KMS migration (§3.4, Phase 3), and per-tenant DEK wrapping
(§13.3, Phase 2).

---

## 3. Why `node:crypto` AES-256-GCM

### 3.1 The choice

**AES-256-GCM via Node's built-in `node:crypto`.** No new dependency, no native build step, no WASM,
no bundler configuration, synchronous API, hardware-accelerated on every platform we deploy to
(AES-NI on x86-64, ARMv8 crypto extensions on Graviton).

```ts
const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: 16 })
```

* **Authenticated.** GCM's auth tag detects any modification of the ciphertext. A row whose
  `national_id` has been tampered with fails to decrypt instead of silently returning attacker data.
* **Parallelisable** in principle, but we use a fresh random IV per value, so we do not exploit it.
* **FIPS-capable.** Node ships FIPS-validated crypto builds; a financial-services-adjacent product
  should not need a bespoke library to claim that.
* **Zero install cost.** `node:crypto` is in the runtime. `package.json` does not change. Vercel's
  serverless Node runtime, the Neon HTTP driver and `tsx` scripts all work unchanged.

### 3.2 Comparison

| Option | Verdict | Why |
|---|---|---|
| **`node:crypto` AES-256-GCM** | ✅ **Chosen** | Zero dependencies; synchronous; AES-NI accelerated; FIPS-capable; stable API across Node 18/20/22/24; works in Vercel serverless with no build flags; the envelope can be built in a few lines. |
| **libsodium** (`libsodium-wrappers` / `libsodium`) | ❌ Rejected | Strictly better *cryptography* in one respect: `crypto_secretbox` (XSalsa20-Poly1305) and XChaCha20-Poly1305 with a 24-byte nonce remove the GCM nonce-reuse hazard entirely. But: `libsodium-wrappers` is a ~100 KB WASM blob with an async init, and the `libsodium` npm package is a native addon that needs node-gyp at install time — exactly the "build breakage on Vercel" risk this design must avoid. It also gives us *no* advantage here, because the nonce discipline is enforced by construction: a fresh `randomBytes(12)` per encryption, and the code never accepts a caller-supplied IV. We get the same AEAD property from a standard library. If we later want XChaCha20-Poly1305, `node:crypto` 24.11+ exposes `chacha20-poly1305` — no dependency needed. |
| **AWS KMS** | ⏸ Deferred (Phase 3) | Best *key custody*: no key material in the app, CloudTrail, IAM policies, automatic rotation. But it costs a network round trip **per field decrypt** — a tenant list of 200 rows becomes 200 KMS calls or a batch — and it introduces a fourth cloud dependency (AWS) plus a new hard failure mode into the request path of a product hosted on Vercel + Neon + Supabase. It also does not give you a blind index for free (you would use KMS HMAC, which is AWS-specific). **The design is deliberately shaped so this swap is possible later without changing a single ciphertext:** the envelope names a *key id*, and the registry maps key id → key bytes. Replacing the registry with "key id → AWS KMS CMK" is a change to one file (§4.2). Do not pay the latency cost before the product needs it. |
| **pgcrypto** (Postgres-side encryption) | ❌ Rejected | Three problems. (1) **Key custody is inverted:** the key must be sent to the database on every call, so it transits the network as a query parameter — it lands in Neon's query log, in any proxy, and in the Neon HTTP driver's request body. A database operator with log access would have the key, which defeats the purpose. (2) `pgcrypto`'s `pgp_sym_encrypt` produces PGP-armoured output (headers, armour, base64), not a compact envelope — several kilobytes per field. (3) The application still needs the key to decrypt, so you end up holding it anyway *and* paying a network round trip per field. pgcrypto is the right tool when the *database* must be the only holder of the key; that is not our threat model. |
| **Deterministic AES (fixed IV / ECB / AES-SIV)** | ❌ Rejected | See §9.2. A fixed IV under GCM is catastrophic (nonce reuse breaks the authentication guarantee and leaks plaintext XOR); ECB leaks block structure; SIV is not in `node:crypto`. We get searchable equality the safe way — a blind index — instead. |

### 3.3 Why application-layer encryption at all, when the platform already encrypts disks

Neon encrypts volumes at rest; Supabase encrypts Storage at rest. Those controls protect against
someone stealing the physical disk or a backup tape. They do **not** protect against:

* a leaked `DATABASE_URL` (a live read credential);
* a read-only Postgres role created for a report or a support engineer;
* `select *` in a support session, a log pipeline, or an error report;
* an accidental `pg_dump` that lands in a shared bucket;
* the platform operator themselves.

Field encryption moves the trust boundary from "the database credential" to "the application
process's environment", which is the boundary we actually want.

### 3.4 Phasing of the key custody upgrade

| Phase | Key custody | Effort |
|---|---|---|
| 1 (this cycle) | Master key in an environment variable, base64, 32 bytes | 1 day |
| 2 | Per-tenant DEK wrapped by the master key (envelope encryption) — §13.3 | 1–2 weeks |
| 3 | The master key replaced by an AWS KMS CMK; the registry maps key id → CMK | 1 week, no ciphertext migration |

---

## 4. Key material and environment variables

### 4.1 The exact variable names

| Variable | Required | Format | Purpose |
|---|---|---|---|
| `PROPDESK_ENCRYPTION_KEYS` | **yes** (or `PROPDESK_ENCRYPTION_KEY`) | JSON object `{"v1":"<base64 32 bytes>","v2":"<base64 32 bytes>"}` — a CSV form `v1=<base64>,v2=<base64>` is also accepted | The encryption key registry. The key with the **highest id** is the *active* key used for all new ciphertexts. |
| `PROPDESK_ENCRYPTION_KEY` | fallback | base64, 32 bytes | Single-key shorthand. Equivalent to `PROPDESK_ENCRYPTION_KEYS={"v1": …}`. Use it only for local development; production uses the registry so rotation is possible without a redeploy. |
| `PROPDESK_BLIND_INDEX_KEYS` | **yes** for blind-index columns | JSON object `{"b1":"<base64 32 bytes>","b2":"<base64 32 bytes>"}` | The blind-index key registry. **Separate from the encryption keys** — see §9.3. Highest id is active. |
| `PROPDESK_BLIND_INDEX_KEY` | fallback | base64, 32 bytes | Single-key shorthand for the blind-index key; equivalent to `{"b1": …}`. |

**Rules — these are not optional:**

* The key is **never** hardcoded, **never** committed, **never** written to the database, **never**
  logged, **never** returned in an API response, and **never** sent to the browser. It lives only in
  the server process environment.
* It is **not** a `NEXT_PUBLIC_*` variable. Nothing prefixed `NEXT_PUBLIC_` is ever a secret.
* **No logging.** Do not `console.log` the registry, the key, or an envelope that contains a
  ciphertext of a sensitive value. A ciphertext in a log is fine (it is not a secret); the key in a
  log is a total compromise. `lib/api/index.ts:55` and `lib/api/with-db-auth.ts:106` log errors —
  make sure a `FieldEncryptionError` message never contains key material (it does not: it names a key
  *id*, never key bytes).
* A **missing key must fail closed.** `encryptField` throws `FieldEncryptionError` when no key is
  configured. It must never fall back to storing plaintext. A deploy that loses its environment
  variable should break writes loudly, not silently degrade the security posture.
* The key is a **32-byte random value**, not a passphrase. Do not use a human-chosen password: it
  would be weak and it would end up in a support ticket.

### 4.2 Generating the keys

```bash
# Encryption key (32 random bytes, base64). Save the output — there is no recovery.
openssl rand -base64 32

# Blind-index key: a DIFFERENT random value. Never reuse the encryption key.
openssl rand -base64 32
```

Put the two outputs into the registry, e.g. for a first install:

```bash
export PROPDESK_ENCRYPTION_KEYS='{"v1":"<base64 from the first command>"}'
export PROPDESK_BLIND_INDEX_KEYS='{"b1":"<base64 from the second command>"}'
```

Store them in the Vercel project environment (Production / Preview / Development) and in the local
`.env.local` — which is already git-ignored (`.gitignore`). Add a `.env.example` entry with the
**names and an empty value**, never a real key:

```
# 32 random bytes, base64. Generate: openssl rand -base64 32
PROPDESK_ENCRYPTION_KEYS=
# Separate 32 random bytes, base64. Generate: openssl rand -base64 32
PROPDESK_BLIND_INDEX_KEYS=
```

### 4.3 The key registry

`getKeyRegistry()` (in §6) memoises a registry built from the environment:

```ts
interface KeyRegistry {
  activeKeyId: string                       // highest id wins
  encryptionKeys: Map<string, Buffer>       // keyId -> 32 bytes
  blindIndexKeys: Map<string, Buffer>       // keyId -> 32 bytes
  activeBlindIndexKeyId: string
}
```

Key ids are compared **naturally**, so `v10` sorts after `v9` (the comparison splits the id into
digit and non-digit runs). This matters the moment the app has ten keys.

**Failure modes are loud, never silent:**

* malformed JSON → `FieldEncryptionError("PROPDESK_ENCRYPTION_KEYS is not valid JSON.")`
* a key that is not exactly 32 bytes → `FieldEncryptionError("PROPDESK_ENCRYPTION_KEYS[v1] must
  decode to exactly 32 bytes … Generate one with: openssl rand -base64 32")`
* no key at all → `FieldEncryptionError("No encryption key configured …")`

`isFieldEncryptionConfigured()` exists for the **startup health check only** (`/api/system/health`) —
it must not be used to decide "skip encryption and store plaintext".

---

## 5. The envelope format

```
v1:<iv-b64>:<authTag-b64>:<ciphertext-b64>
```

| Segment | Bytes | Encoding | Notes |
|---|---|---|---|
| `v1` | — | ASCII | **The version prefix AND the key id.** `v1`, `v2`, `v3` … each map to a registry entry. |
| `iv` | 12 | base64 (standard) | 96-bit nonce, `crypto.randomBytes(12)` — a fresh one for every single encryption. Never reused. |
| `authTag` | 16 | base64 (standard) | GCM authentication tag, 128 bits. |
| `ciphertext` | = plaintext length | base64 (standard) | GCM is a stream mode, so the ciphertext is exactly as long as the plaintext. |

**Unambiguity.** The string is split on `:`. The standard base64 alphabet
(`A–Z a–z 0–9 + /` plus up to two trailing `=`) **never contains a colon**, so a colon inside the
payload is impossible and the split cannot be confused. A well-formed envelope has exactly four
segments; anything else is treated as legacy plaintext. The parser additionally validates that the
iv decodes to exactly 12 bytes and the tag to exactly 16 bytes, so a truncated or corrupt value is
detected rather than mis-parsed.

**Why the key id is the version prefix.** It makes rotation free: the ciphertext carries the key it
was written with, so the reader knows exactly which key to use, and a rotation is just "register a
new key id, write with it, re-encrypt the old rows". No separate key-id column, no migration of
the schema, and old rows keep decrypting as long as the old key stays registered.

**Example (a Kenyan national ID `23456789`):**

```
v1:9pQ2rS0nKq3pT9vX2wY8Zg==:6dQ2m0cQq1sT3rV5xZ8bN1w==:kQ2vS0nKq3pT9vX2wY8Zg
```

**Do not** put the plaintext in the envelope, do not add a "hint" segment (it would leak), and do not
change the segment order without bumping the version prefix to `v2` and keeping a `v1` reader.

---

## 6. `lib/crypto/field-encryption.ts` — exact source

Place the file at `lib/crypto/field-encryption.ts`. It has **no imports from the application** — only
`node:crypto` — so it can be used from route handlers, server components and `tsx` scripts alike.

**Verified:** this source compiles cleanly under the repository's `tsconfig.json`
(`strict: true`, `target: ES6`, `moduleResolution: "bundler"`, `isolatedModules: true`) and passes a
35-assertion runtime smoke test (round trip, randomised IV, AAD-context enforcement, tamper
detection, rotation, blind index, constant-time compare, row helpers). §17 is the test to add to
the repo.

```ts
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
 * Reset the memoised registry. Test-only.
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
 * True when the value looks like an envelope produced by `encryptField`.
 */
export function isEncryptedField(value: string | null | undefined): boolean {
  if (!value) return false
  return parseEnvelope(value) !== null
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
export function decryptField(
  payload: string | null | undefined,
  opts: FieldOptions = {},
): string | null {
  if (payload === null || payload === undefined) return null

  const parsed = parseEnvelope(payload)
  if (!parsed) return payload

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
export function decryptFieldWithRotation(
  payload: string | null | undefined,
  opts: FieldOptions = {},
): DecryptResult | null {
  if (payload === null || payload === undefined) return null

  const parsed = parseEnvelope(payload)
  if (!parsed) {
    // Legacy plaintext: decrypt is a no-op, but it still needs encrypting.
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
 * Every blind-index value that could match the given input — one per
 * registered blind-index key. Use this during a blind-index key rotation
 * window so old rows still match.
 */
export function blindIndexCandidates(
  value: string | null | undefined,
  opts: BlindIndexOptions = {},
): string[] {
  if (value === null || value === undefined) return []
  const registry = getKeyRegistry()
  const ids = opts.keyId ? [opts.keyId] : [...registry.blindIndexKeys.keys()]
  return ids.map((id) => blindIndex(value, { ...opts, keyId: id }) as string)
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
```

### 6.1 The exported API (contract)

| Export | Signature | Contract |
|---|---|---|
| `ENVELOPE_VERSION` | `"v1"` | The current envelope version. |
| `CIPHER_ALGORITHM` | `"aes-256-gcm"` | |
| `IV_LENGTH` / `AUTH_TAG_LENGTH` / `KEY_LENGTH` | `12` / `16` / `32` | |
| `FieldEncryptionError` | `class extends Error` | Thrown for every crypto failure. Never carries key material. |
| `getKeyRegistry()` | `() => KeyRegistry` | Memoised. Throws when unconfigured/malformed. |
| `resetKeyRegistry()` | `() => void` | Test-only. |
| `isFieldEncryptionConfigured()` | `() => boolean` | For health checks only. |
| `encryptField(plaintext, opts?)` | `(string \| null \| undefined, { context? }) => string \| null` | `null`/`undefined` → `null`. A fresh random IV per call. |
| `decryptField(payload, opts?)` | same shape | A non-envelope value is returned **unchanged** (legacy plaintext). Throws on an unknown key id or a failed tag check. |
| `decryptFieldStrict(payload, opts?)` | same shape | Throws when the value is not an envelope. Used by the backfill. |
| `decryptFieldWithRotation(payload, opts?)` | `=> DecryptResult \| null` | `{ plaintext, keyId, reencrypted }`. `reencrypted` is non-null when the stored value is not under the active key (or is legacy plaintext). |
| `isEncryptedField(value)` | `=> boolean` | Does the value look like an envelope? |
| `getEnvelopeKeyId(value)` | `=> string \| null` | Which key was it written with? |
| `blindIndex(value, opts?)` | `=> string \| null` | `"<keyId>:<hex-hmac>"`. Deterministic. |
| `blindIndexCandidates(value, opts?)` | `=> string[]` | One per registered blind-index key — used during a blind-index rotation window. |
| `timingSafeEqualString(a, b)` | `=> boolean` | Constant-time secret comparison. Never throws. |

---

## 7. `lib/crypto/pii-columns.ts` — exact source

Place the file at `lib/crypto/pii-columns.ts`. It encodes the plan from §9 as data so the read and
write paths cannot drift from the documentation.

**Note on `normalizePhoneE164`:** it must produce byte-identical output to `normalizePhone` at
`lib/mpesa/daraja.ts:249-255`. **Make `lib/mpesa/daraja.ts` import this function and delete its
copy** — two normalisers that drift apart produce blind indexes that silently stop matching, and a
blind index that does not match is indistinguishable from "the tenant was not found".

```ts
/**
 * lib/crypto/pii-columns.ts
 *
 * The per-column encryption plan, expressed as code so the read and write
 * paths cannot drift from the documented design
 * (audit/design/encryption-design.md §7).
 *
 * Each entry names one column that holds PII, the mode used to protect it and
 * the strategy used to look it up again. `encryptRow` / `decryptRow` apply the
 * plan to a whole row so a route never has to remember which fields are
 * sensitive.
 *
 * RUNTIME: Node.js only (imports node:crypto through ./field-encryption).
 */

import {
  blindIndex,
  decryptField,
  decryptFieldWithRotation,
  encryptField,
} from "./field-encryption"

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
  /** Match with `WHERE <blindIndexColumn> = $1`. */
  | "blind-index"
  /** Load the candidate rows, decrypt in the app, compare in memory. */
  | "decrypt-in-app"

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
  /** Normaliser applied before computing the blind index. */
  normalize?: "phone-e164" | "email" | "text"
  /** Why this column is treated the way it is. */
  rationale: string
}

/**
 * Normalise a Kenyan phone number to E.164 (`2547XXXXXXXX`).
 *
 * This MUST produce byte-identical output to `normalizePhone` in
 * lib/mpesa/daraja.ts:249-255 — otherwise a blind index computed on the write
 * path will not match one computed on the lookup path. The recommended change
 * is to make lib/mpesa/daraja.ts import this function, so there is exactly one
 * implementation.
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

/**
 * The plan. Every column listed here must be handled by `encryptRow` /
 * `decryptRow` on both the read and the write path.
 */
export const PII_COLUMNS: readonly PiiColumnSpec[] = [
  {
    table: "tenants",
    column: "national_id",
    mode: "randomised",
    context: "tenants.national_id",
    lookup: "none",
    rationale:
      "Kenyan national ID. Displayed, never searched, so a randomised envelope is enough — no blind index, no equality leakage.",
  },
  {
    table: "tenants",
    column: "phone",
    mode: "blind-index",
    context: "tenants.phone",
    lookup: "blind-index",
    blindIndexColumn: "phone_bidx",
    normalize: "phone-e164",
    rationale:
      "Looked up by phone in the M-Pesa C2B validation path (app/api/mpesa/c2b/validation/route.ts:75-80) and matched in memory by the reconciliation engine.",
  },
  {
    table: "tenants",
    column: "email",
    mode: "randomised",
    context: "tenants.email",
    lookup: "none",
    rationale:
      "Contact detail. Not queried in the product today; a blind index is added only if a search feature lands.",
  },
  {
    table: "tenants",
    column: "emergency_contact_name",
    mode: "randomised",
    context: "tenants.emergency_contact_name",
    lookup: "none",
    rationale:
      "Third-party PII (the emergency contact is neither landlord nor tenant). Column exists only on the Supabase path today — add it to the Neon schema first (CRYPTO-022).",
  },
  {
    table: "tenants",
    column: "emergency_contact_phone",
    mode: "blind-index",
    context: "tenants.emergency_contact_phone",
    lookup: "none",
    blindIndexColumn: "emergency_contact_phone_bidx",
    normalize: "phone-e164",
    rationale: "Third-party PII. Not looked up, but the index is maintained so a future search cannot be added casually.",
  },
  {
    table: "mpesa_transactions",
    column: "phone",
    mode: "randomised",
    context: "mpesa_transactions.phone",
    lookup: "none",
    rationale: "MSISDN of the payer. Not queried; the transaction is found by checkout_request_id.",
  },
  {
    table: "c2b_transactions",
    column: "msisdn",
    mode: "randomised",
    context: "c2b_transactions.msisdn",
    lookup: "none",
    rationale:
      "Payer MSISDN. The reconciliation engine loads the candidate tenants and compares phones in memory (lib/reconcile.ts:80-88), so no index is needed here.",
  },
  {
    table: "c2b_transactions",
    column: "first_name",
    mode: "randomised",
    context: "c2b_transactions.first_name",
    lookup: "none",
    rationale: "Payer legal name.",
  },
  {
    table: "c2b_transactions",
    column: "middle_name",
    mode: "randomised",
    context: "c2b_transactions.middle_name",
    lookup: "none",
    rationale: "Payer legal name.",
  },
  {
    table: "c2b_transactions",
    column: "last_name",
    mode: "randomised",
    context: "c2b_transactions.last_name",
    lookup: "none",
    rationale: "Payer legal name.",
  },
  {
    table: "contacts",
    column: "email",
    mode: "randomised",
    context: "contacts.email",
    lookup: "none",
    rationale: "Contact PII held by the landlord.",
  },
  {
    table: "contacts",
    column: "phone",
    mode: "blind-index",
    context: "contacts.phone",
    lookup: "blind-index",
    blindIndexColumn: "phone_bidx",
    normalize: "phone-e164",
    rationale: "Contact PII. Indexed so a future 'find contact by phone' does not require a deterministic cipher.",
  },
  {
    table: "managed_landlords",
    column: "contact_email",
    mode: "randomised",
    context: "managed_landlords.contact_email",
    lookup: "none",
    rationale: "A landlord's contact details held by the agency that manages them.",
  },
  {
    table: "managed_landlords",
    column: "contact_phone",
    mode: "blind-index",
    context: "managed_landlords.contact_phone",
    lookup: "none",
    blindIndexColumn: "contact_phone_bidx",
    normalize: "phone-e164",
    rationale: "A landlord's contact details held by the agency that manages them.",
  },
  {
    table: "user_profiles",
    column: "phone",
    mode: "randomised",
    context: "user_profiles.phone",
    lookup: "none",
    rationale: "The landlord's own phone number.",
  },
  {
    table: "documents",
    column: "name",
    mode: "randomised",
    context: "documents.name",
    lookup: "none",
    rationale:
      "Identity-document filenames leak identity on their own (e.g. 'Passport-Jane-Kimani.pdf'). The file bytes stay in Storage; the metadata is encrypted here.",
  },
  {
    table: "paybills",
    column: "number",
    mode: "blind-index",
    context: "paybills.number",
    lookup: "blind-index",
    blindIndexColumn: "number_bidx",
    normalize: "text",
    rationale:
      "The Safaricom paybill / till number. It is the ONLY way a Daraja callback finds the landlord (app/api/mpesa/c2b/confirmation/route.ts:102), so it must stay searchable — hence a blind index rather than an opaque envelope. NOTE: the space is small (5-7 digits, see app/api/paybill/route.ts:21), so this blind index is a low-entropy oracle: protect PROPDESK_BLIND_INDEX_KEYS accordingly, and pair it with the audit log and rate limiting on the C2B endpoints. The randomised envelope still removes the number from a plain database dump.",
  },
  {
    table: "paybills",
    column: "label",
    mode: "plaintext",
    context: "paybills.label",
    lookup: "none",
    rationale:
      "A landlord-chosen nickname ('Westlands paybill'). No personal data, so encrypting it only breaks the UI.",
  },
  {
    table: "c2b_transactions",
    column: "bill_ref_number",
    mode: "randomised",
    context: "c2b_transactions.bill_ref_number",
    lookup: "none",
    rationale:
      "The payer-supplied account reference. It encodes a tenant id, so it is an identifier; it is never queried.",
  },
  {
    table: "c2b_transactions",
    column: "raw",
    mode: "plaintext",
    context: "c2b_transactions.raw",
    lookup: "none",
    rationale:
      "NOT a column to encrypt — REDACT it. The whole Daraja payload duplicates MSISDN, payer name and receipt. Keep only TransID, TransTime, TransAmount, BusinessShortCode, BillRefNumber, MpesaReceiptNumber and ResultCode (CRYPTO-004).",
  },
  {
    table: "mpesa_transactions",
    column: "raw_response",
    mode: "plaintext",
    context: "mpesa_transactions.raw_response",
    lookup: "none",
    rationale: "Redact to the whitelist, as for c2b_transactions.raw (CRYPTO-004).",
  },
  {
    table: "mpesa_transactions",
    column: "raw_callback",
    mode: "plaintext",
    context: "mpesa_transactions.raw_callback",
    lookup: "none",
    rationale: "Redact to the whitelist, as for c2b_transactions.raw (CRYPTO-004).",
  },
  {
    table: "notes",
    column: "content",
    mode: "plaintext",
    context: "notes.content",
    lookup: "none",
    rationale:
      "Free text. Column-wise encryption would break search and the editor. Handle with data minimisation + the DLP scrubber in design §8, not with encryption.",
  },
  {
    table: "notifications",
    column: "message",
    mode: "plaintext",
    context: "notifications.message",
    lookup: "none",
    rationale:
      "Free text that embeds the tenant's full name (db/migrations/002-support.sql:35-46). Redact the name out of the message text instead of encrypting the column.",
  },
]

/* -------------------------------------------------------------------------- */
/* Row helpers                                                                  */
/* -------------------------------------------------------------------------- */

function specsFor(table: string): PiiColumnSpec[] {
  return PII_COLUMNS.filter((s) => s.table === table && s.mode !== "plaintext")
}

function normalizerFor(spec: PiiColumnSpec): ((value: string) => string) | undefined {
  if (spec.normalize === "phone-e164") return normalizePhoneE164
  if (spec.normalize === "email") return normalizeEmail
  return undefined
}

/**
 * Encrypt every protected column of a row, in place, and refresh the blind
 * index columns. Returns the same object.
 */
export function encryptRow<T extends Record<string, unknown>>(
  table: string,
  row: T,
): T {
  const target = row as Record<string, unknown>
  for (const spec of specsFor(table)) {
    const current = target[spec.column]
    if (current === null || current === undefined) continue
    if (typeof current !== "string") continue
    if (isEnvelope(current)) continue

    target[spec.column] = encryptField(current, { context: spec.context })

    if (spec.mode === "blind-index" && spec.blindIndexColumn) {
      const normalize = normalizerFor(spec)
      const idx = blindIndex(current, { normalize })
      if (idx) target[spec.blindIndexColumn] = idx
    }
  }
  return row
}

/**
 * Decrypt every protected column of a row, in place. The blind index columns
 * are left untouched (they are not secret — they are the index).
 */
export function decryptRow<T extends Record<string, unknown>>(
  table: string,
  row: T,
): T {
  const target = row as Record<string, unknown>
  for (const spec of specsFor(table)) {
    const current = target[spec.column]
    if (typeof current !== "string") continue
    target[spec.column] = decryptField(current, { context: spec.context })
  }
  return row
}

/**
 * Decrypt a row and report which columns would be re-encrypted under the
 * active key. Used by the rotation job.
 */
export function rotationPlanForRow<T extends Record<string, unknown>>(
  table: string,
  row: T,
): Array<{ column: string; reencrypted: string }> {
  const out: Array<{ column: string; reencrypted: string }> = []
  for (const spec of specsFor(table)) {
    const current = row[spec.column]
    if (typeof current !== "string") continue
    const res = decryptFieldWithRotation(current, { context: spec.context })
    if (res && res.reencrypted) out.push({ column: spec.column, reencrypted: res.reencrypted })
  }
  return out
}

function isEnvelope(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9_-]{0,31}:[A-Za-z0-9+/=]{16}:[A-Za-z0-9+/=]{24}:[A-Za-z0-9+/=]*$/.test(value)
}
```

---

## 8. Free text: minimisation, not encryption

`notes.content`, `documents.notes`, `tenants.notes`, `expenses.notes` and `notifications.message`
are free text. A landlord will paste a national ID number into a note. Column-wise encryption would
break full-text search, the editors and the notifications feed, and it does not solve the problem
anyway — the PII would still be in the row, just in a blob.

The design therefore treats free text with **data minimisation plus a DLP scrubber**, not encryption:

1. **Scrubber on write.** A small module `lib/pii/scrub.ts` detects Kenyan national ID numbers
   (`/^\d{7,8}$/` after stripping separators — validate with the length rules the product already
   uses for `national_id`) and M-Pesa receipt numbers (`/^[A-Z0-9]{10,12}$/i` matching the
   `mpesa_receipt` shape). When a match is found, the value is **removed from the free-text field**
   and written to the encrypted column for that table instead (`notes.pii_redacted`, encrypted with
   the same envelope). The user sees "A national ID number was detected in this note and stored
   securely. Show".
2. **Prompt, don't block.** The scrubber must not silently lose a landlord's data. Show what was
   moved and where.
3. **Notifications.** `db/migrations/002-support.sql:35-46` interpolates the tenant's full name into
   `notifications.title` / `.message`. Change the SQL to use a stable reference ("Tenant 4a2f…") and
   keep the name out of the notification text; the dashboard can resolve the name from the tenant
   row it already has.
4. **The names themselves (`tenants.full_name`, `first_name`, `last_name`) are deliberately NOT
   encrypted.** They are needed for sorting, grouping, the tenant list UI and the reconciliation
   engine, they are low-sensitivity compared with a national ID, and encrypting them would break
   every list view for no proportionate gain. This is a deliberate, documented decision — record it
   in the privacy policy's "what we collect" section so the data map is honest.

---

## 9. Deterministic vs randomised, and the blind index

### 9.1 The two modes

| Mode | Property | Use it for | Cost |
|---|---|---|---|
| **Randomised** | Same plaintext → different ciphertext every time (fresh random IV) | `tenants.national_id`, `tenants.email`, `c2b_transactions.msisdn`, the payer names, `contacts.*`, `user_profiles.phone`, `documents.name` | No equality search, no `UNIQUE`, no `GROUP BY`, no `ORDER BY` |
| **Blind index** | The *value* is randomised; a separate HMAC column is deterministic | `tenants.phone`, `contacts.phone`, `paybills.number` | A second column, a second key to manage, the index must be refreshed when the value changes |

### 9.2 Why not a deterministic cipher

A deterministic encryption of `phone` (same plaintext → same ciphertext) makes the column
searchable — but:

* **It leaks equality.** An attacker with read access to the table learns that two tenants share a
  phone number, that a phone number recurs across tenants, and the frequency of each value. With
  `national_id` the same attack turns the column into a cross-tenant join key.
* **Under GCM, a fixed IV is catastrophic.** Reusing a nonce with the same key leaks the XOR of the
  two plaintexts *and* destroys the authentication guarantee for both. A "deterministic AES" that
  reuses an IV is a one-line-away catastrophe. AES-SIV is the correct construction, and it is **not
  in `node:crypto`**.
* **A deterministic column cannot be `UNIQUE`d or indexed safely** without leaking the same
  equality signal at the index level.

The randomised mode plus a blind index gives us the searchability **and** the randomised value.

### 9.3 The blind index

```
blind_index = "<blindKeyId>:" + hex( HMAC-SHA256( blindKey, normalise(value) ) )
```

* **A separate key.** `PROPDESK_BLIND_INDEX_KEYS` is a *different* random value from
  `PROPDESK_ENCRYPTION_KEYS`. Two reasons: (a) possession of the blind-index key does not permit
  decryption; (b) the two can be rotated on independent schedules — the encryption key rotates
  without touching a single index, and the index key rotates without re-encrypting a single value.
* **Normalisation before hashing.** The same value written as `0712345678`, `+254 712 345 678` and
  `254712345678` must produce the same index, otherwise lookups silently miss. `normalizePhoneE164`
  (§7) is the canonical normaliser for phones; `normalizeEmail` lower-cases and trims for emails.
  The normaliser must be applied on **both** the write and the lookup path.
* **Key id in the value.** `b1:<hex>` means a blind-index key rotation can run both keys side by
  side: `blindIndexCandidates()` returns one candidate per registered key and the query becomes
  `WHERE phone_bidx = ANY($1)`. After the re-index completes, retire the old key.
* **What it leaks.** Equality of the indexed field, and nothing else. The index is 32 bytes of
  HMAC output; recovering the phone number from it requires the blind-index key and a dictionary
  attack over the ~10^8 plausible Kenyan mobile numbers (which is why the key must stay secret and
  must not be the encryption key).

### 9.4 Safe search and filter strategy for encrypted columns

In strict order of preference:

1. **Equality on the blind index** — the only pattern that may reach the database:
   ```sql
   SELECT id, ... FROM public.tenants
   WHERE user_id = $1 AND phone_bidx = $2
   ```
   `$2` is `blindIndex(normalizePhoneE164(input))`. The blind-index column gets a B-tree index
   (`CREATE INDEX tenants_phone_bidx_idx ON public.tenants (phone_bidx)`).

2. **Decrypt-and-filter in the app, over an already-scoped set** — for fuzzy or partial matching.
   Load the **landlord's own rows only** (`WHERE user_id = $1`), decrypt them in the server, and
   compare in memory. This is what the reconciliation engine already does
   (`lib/reconcile.ts:76-88`, `app/api/mpesa/c2b/confirmation/route.ts:126-147`).
   **Never** load all tenants and filter in JS.

3. **Prefix search** — HMAC is not order-preserving, so `LIKE` cannot work. If a "starts with"
   feature is ever needed, add a **truncated blind index** column
   (`phone_prefix7_bidx = HMAC(key, value.slice(0, 7))`) and combine it with a narrowing filter.
   Be aware this leaks the prefix to anyone with read access — it is a deliberate, bounded trade.

4. **Never** `LIKE '%…%'` on an encrypted column, never `ORDER BY` an encrypted column, never
   `GROUP BY` an encrypted column, never `UNIQUE` an encrypted column.

5. **Never** compare a decrypted value in SQL (`WHERE national_id = $1` after decrypting in the app
   would send the plaintext to the database and defeat the purpose). If a uniqueness check is
   needed, use a blind index.

---

## 10. Password, auth and secret comparison

### 10.1 What is already correct (do not change it)

* **Passwords**: Supabase Auth hashes them (bcrypt, in GoTrue). The application only calls
  `signInWithPassword` (`lib/actions.ts:26-29`), `signUp` (`lib/actions.ts:70-76`) and
  `updateUser` (`app/(marketing)/auth/reset-password/form.tsx:57`). No password is ever stored,
  hashed or compared by PropDesk. **Do not add an application-side password scheme.**
* **OTP / verification codes**: none exist. No code column, no code table, no code comparison
  anywhere. Email verification and password reset are delegated to Supabase Auth
  (`lib/actions.ts:70-76`, `app/(marketing)/auth/forgot-password/action.ts:12-14`). If a code-based
  flow is added, store only `HMAC(code, per-flow-salt)`, the flow id, the expiry and the attempt
  counter — never the code.
* **Stripe webhook signature**: `getStripe().webhooks.constructEvent(payload, signature, secret)`
  (`app/api/stripe/webhook/route.ts:13`) is the SDK's constant-time HMAC-SHA256 verification and
  throws on mismatch. **No change needed.**
* **M-Pesa callback secret**: `app/api/mpesa/callback/route.ts:34` already uses `timingSafeEqual`
  with a length guard. The guard is a **length oracle** and compares UTF-16 code units rather than
  bytes; replace it with the helper below.

### 10.2 The pattern to use everywhere

`crypto.timingSafeEqual` **throws** when the two buffers have different lengths, so the naive
"compare the two secrets directly" pattern is a crash bug waiting to happen (and the "fix" of
dropping the length check re-introduces the timing leak). Compare **fixed-length digests** instead:

```ts
// lib/crypto/field-encryption.ts
export function timingSafeEqualString(a, b): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false
  const da = createHash("sha256").update(a, "utf8").digest()
  const db = createHash("sha256").update(b, "utf8").digest()
  return timingSafeEqual(da, db)
}
```

Both digests are exactly 32 bytes, so `timingSafeEqual` can never throw, the length of the expected
secret is not observable, and the code-unit/byte mismatch disappears.

### 10.3 The call sites to change

| File:line | Current | Replace with |
|---|---|---|
| `app/api/cron/run/route.ts:26-32` | `if (got !== secret)` | `if (!timingSafeEqualString(got, secret))` — and **fail closed in every environment**, not only in production (`:23-25` currently allows an unset secret outside production) |
| `app/api/migrations/run/route.ts:49` | `if (expected && got === expected)` | `if (expected && !timingSafeEqualString(got, expected))` → fall through to the 403 path |
| `app/api/migrations/reset/route.ts:44` | `if (expected && got === expected)` | same |
| `app/api/migrations/rollback/route.ts:35` | `if (expected && got === expected)` | same |
| `app/api/backup/auto/route.ts:38` | `got === expected ? null : 403` | `timingSafeEqualString(got, expected) ? null : 403`, and remove the `return null // dev only` branch at `:35` |
| `app/api/mpesa/callback/route.ts:34` | length-guarded `timingSafeEqual` | `timingSafeEqualString(providedSecret, callbackSecret)` |

Each of these files must also `import { timingSafeEqualString } from "@/lib/crypto/field-encryption"`
and declare `export const runtime = "nodejs"`.

### 10.4 Other secret hygiene in this cycle

* `SUPABASE_SERVICE_ROLE_KEY` must only be used where a user-scoped client cannot work (the three
  public callbacks and the signed-URL helper). Remove the service-role branch from
  `app/api/properties/[id]/photos/route.ts:59-63` (CRYPTO-006, CRYPTO-024).
* `MPESA_ALLOWED_CALLBACK_IPS` (`lib/mpesa/daraja.ts:268-283`) is a good control but it **fails open**
  in non-production (`:270-272` returns `true` when the list is empty). Make the empty-list case
  fail closed in production and log a warning in development.
* `app/api/mpesa/c2b/validation/route.ts:95-97` "accept by default" — a public endpoint that
  accepts a payment it cannot identify. Keep the behaviour (rejecting real payments is worse) but
  **log it** and make the lookup owner-scoped (CRYPTO-023).

---

## 11. Read-path and write-path migration

### 11.1 Phase 0 — move the sensitive reads behind the server (BLOCKING)

**Why:** the dashboard reads `tenants` with `select("*")` straight from the browser
(`app/dashboard/tenants/[id]/page.tsx:27-36`, `app/dashboard/tenants/page.tsx:37-47`,
`app/dashboard/properties/[id]/page.tsx:27-31`, `app/dashboard/contacts/page.tsx:20-24`,
`app/dashboard/documents/page.tsx:23`, `app/dashboard/documents/[id]/page.tsx:27`,
`app/dashboard/paybill/page.tsx:22-23`, `app/dashboard/reconciliation/page.tsx:38-41`). The browser
holds the anon key and cannot decrypt. Until this is done, encryption breaks the UI.

**How:** for each of those pages, either

* convert the page to a **server component** and read through `getDb()` / `createClient()` on the
  server, decrypting with `decryptRow`, or
* add a server route (e.g. `GET /api/tenants` already exists — reuse it) and have the client
  component `apiFetch` it.

The API routes already exist for most of these (`/api/tenants`, `/api/documents`, `/api/paybill`,
`/api/properties/[id]/photos`). **Prefer the existing API routes** — they already scope by
`user_id`.

**Acceptance:** `grep -rn 'from("tenants")\|from("contacts")\|from("c2b_transactions")' app/dashboard`
returns only server-side files.

**Also in Phase 0:** `/api/export` (`app/api/export/route.ts:20-29`) and
`/api/backup/csv/[table]` (`app/api/backup/csv/[table]/route.ts:19-21`) read through the
**Supabase** client while the API routes write through **Neon**. On a Neon deployment those two
paths do not even see the same rows. Point both at the same data layer the rest of the app uses
(`getDb()` from `lib/db/neon.ts:36-42` when `neonConfigured()`, otherwise the Supabase client), so
that "the export shows my data" is true. This is the same defect as CRYPTO-016/025 seen from the
export angle, and it must be fixed before the export can be made decrypt-aware in §14.4.

### 11.2 Write path

All writes already go through the server (`components/tenant-form.tsx:85` → `apiFetch`). Apply
`encryptRow` in the route handlers:

**`app/api/tenants/route.ts` (POST)** — after building `insert` (`:58-76`):

```ts
import { encryptRow } from "@/lib/crypto/pii-columns"
// …
const insert: Record<string, any> = { … }            // unchanged
encryptRow("tenants", insert)                         // ← add
const { data, error } = await supabase.from("tenants").insert([insert])…
```

`encryptRow` encrypts `national_id`, `phone`, `email`, `emergency_contact_*` and writes
`phone_bidx` / `emergency_contact_phone_bidx`.

**`app/api/tenants/[id]/route.ts` (PUT)** — after building `update` (`:43-65`):

```ts
encryptRow("tenants", update)
```

Caveat: `encryptRow` skips values that are already envelopes, so a PUT that echoes back a value
already read from the row (and therefore already decrypted by the read path) is re-encrypted with a
**new random IV** — which is correct and desirable.

**Other write paths:**

| Route | Change |
|---|---|
| `app/api/mpesa/stkpush/route.ts:65-77` | `encryptRow("mpesa_transactions", tx)` before the insert. `phone` is the MSISDN. |
| `app/api/mpesa/c2b/confirmation/route.ts:163-181` (Neon) and `:235-251` (Supabase) | Encrypt `msisdn`, `first_name`, `middle_name`, `last_name`, `bill_ref_number`; **replace `raw`/`raw_callback` with the whitelist** (§12.1). |
| `app/api/mpesa/callback/route.ts:69-77` | `raw_callback: body` → the whitelist. |
| `app/api/paybill/route.ts` (create/update) | `encryptRow("paybills", row)` — `number` becomes an envelope, `number_bidx` is written. |
| `app/api/profile/route.ts:24-41` | `encryptRow("user_profiles", update)`. |
| `app/api/documents/route.ts:53-67` and `app/api/documents/[id]/route.ts:39-53` | `encryptRow("documents", row)`; also stop storing a public URL (§12.2). |
| contacts / team / managed-landlord writes | `encryptRow("contacts", row)` etc. |

### 11.3 Read path

| Route | Change |
|---|---|
| `app/api/tenants/route.ts:29-40` | `decryptRow("tenants", row)` on every row before returning. |
| `app/api/tenants/[id]/route.ts:24-32` | same. |
| `app/api/documents/route.ts:26-38`, `app/api/documents/[id]/route.ts:20-29` | `decryptRow("documents", row)`; replace `file_url` with a signed URL (§12.2). |
| `app/api/export/route.ts:20-29` | `decryptRow` per table before serialising — the export must show the landlord their real data, not envelopes. |
| `app/api/backup/csv/[table]/route.ts:19-21` | same. |
| `app/api/mpesa/c2b/confirmation/route.ts:126-147` (`buildContext`) | `decryptRow("tenants", row)` after the query, **before** the in-memory phone comparison. |
| `app/api/mpesa/c2b/validation/route.ts:75-80` | Replace the plaintext `WHERE phone = …` with the blind-index lookup (§9.4 rule 1) **and** add `and t.user_id = $owner` (CRYPTO-023). |
| `app/api/mpesa/c2b/confirmation/route.ts:102` (`resolveOwnerByShortCode`) | Replace `where number = $1` with `where number_bidx = $1` using `blindIndex(shortCode)`. **Without this the M-Pesa callback stops finding the landlord.** |
| `app/api/paybill/route.ts` (list) | `decryptRow("paybills", row)`. |

### 11.4 The schema change

`db/migrations/003-pii-encryption.sql`:

```sql
-- Blind-index columns for the searchable encrypted fields.
alter table public.tenants
  add column if not exists phone_bidx text,
  add column if not exists emergency_contact_phone_bidx text;

create index if not exists tenants_phone_bidx_idx
  on public.tenants (phone_bidx) where phone_bidx is not null;

alter table public.contacts
  add column if not exists phone_bidx text;
create index if not exists contacts_phone_bidx_idx
  on public.contacts (phone_bidx) where phone_bidx is not null;

alter table public.managed_landlords
  add column if not exists contact_phone_bidx text;

alter table public.paybills
  add column if not exists number_bidx text;
create index if not exists paybills_number_bidx_idx
  on public.paybills (number_bidx) where number_bidx is not null;

-- IMPORTANT: the existing uniqueness constraint is on the PLAINTEXT number.
-- Once `number` holds a randomised envelope, two paybills with the same
-- number encrypt to DIFFERENT envelopes and the constraint stops detecting
-- duplicates. Move the constraint onto the blind index.
--   source: supabase-setup/10-holy-grail.sql:63  unique (user_id, number, type)
alter table public.paybills drop constraint if exists paybills_user_id_number_type_key;
alter table public.paybills
  add constraint paybills_user_id_number_bidx_type_key
  unique (user_id, number_bidx, type);

-- Third-party PII columns missing from the Neon schema (CRYPTO-022).
alter table public.tenants
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text;

-- Audit log (CRYPTO-015). See design §15.
create table if not exists public.data_access_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  actor_role text not null default 'user',
  action text not null,                       -- read | write | export | download | delete
  resource_type text not null,                -- tenants | documents | c2b_transactions | …
  resource_id text,                           -- uuid of the row, or NULL for a bulk read
  outcome text not null default 'ok',         -- ok | denied | error
  request_id text,
  ip_hash text,                              -- sha256(ip + daily salt) — never the raw IP
  row_count integer,
  created_at timestamptz not null default now()
);
create index if not exists data_access_audit_user_created_idx
  on public.data_access_audit (user_id, created_at desc);
create index if not exists data_access_audit_resource_idx
  on public.data_access_audit (resource_type, resource_id, created_at desc);
```

**Unique constraints over encrypted columns must move to the blind index.** This is the single
easiest mistake to make in this migration. A randomised envelope differs for every write, so a
`UNIQUE` constraint on an encrypted column silently stops detecting duplicates the moment the
backfill runs. The only such constraint in the schema is
`unique (user_id, number, type)` on `paybills` (`supabase-setup/10-holy-grail.sql:63`); it is
replaced above by `unique (user_id, number_bidx, type)`. The duplicate-detection behaviour at
`app/api/paybill/route.ts:51` (which handles the `23505` unique-violation code) is preserved
because the new constraint still fires — but only if `number_bidx` is written on every insert.
Audit for any other unique index over a column in the §10 plan before running the backfill.

**The existing columns are reused, not renamed.** `tenants.national_id` keeps its name and now
holds an envelope. This means:

* no column type change, no `ALTER … TYPE`, no backfill of a new column;
* a partially-migrated table is valid: `decryptField` passes legacy plaintext through;
* `text` holds a ~150-character envelope comfortably.

**One column type caveat:** `tenants.national_id` has no length constraint in the Neon schema
(`db/migrations/001-core.sql:84`), so an envelope fits. Verify no `varchar(n)` constraint exists on
the Supabase path (`supabase-setup/01-create-tables.sql:64` is `TEXT` ✓).

---

## 12. Storage protection

### 12.1 The buckets

| Bucket | Current | Target |
|---|---|---|
| `documents` | **public** (`supabase-setup/01-create-tables.sql:326-328`, `:353-355`) | **private** |
| `property-photos` | does not exist (photos are in `documents`) | **private**, new bucket |
| `backups` | exists, **no policies defined at all** | **private**, with policies |

### 12.2 The concrete policy change

```sql
-- 1. Make the document bucket private.
update storage.buckets set public = false where id = 'documents';

-- 2. Dedicated private bucket for property photos.
insert into storage.buckets (id, name, public)
values ('property-photos', 'property-photos', false)
on conflict (id) do nothing;

-- 3. Private backup bucket (create it if missing; it has no policies today).
insert into storage.buckets (id, name, public)
values ('backups', 'backups', false)
on conflict (id) do nothing;

-- 4. Drop the now-ineffective public-bucket read policies and re-create
--    owner-scoped ones for the private buckets.
drop policy if exists "Users can read their own documents" on storage.objects;
drop policy if exists "Users can upload their own documents" on storage.objects;
drop policy if exists "Users can update their own documents" on storage.objects;
drop policy if exists "Users can delete their own documents" on storage.objects;

create policy "Users can upload their own documents" on storage.objects
  for insert with check (
    bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "Users can read their own documents" on storage.objects
  for select using (
    bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "Users can update their own documents" on storage.objects
  for update using (
    bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "Users can delete their own documents" on storage.objects
  for delete using (
    bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Same four policies for the photos bucket, with the photos path prefix
-- (see §12.3: the path must start with the user id).
create policy "Users can upload their own property photos" on storage.objects
  for insert with check (
    bucket_id = 'property-photos' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "Users can read their own property photos" on storage.objects
  for select using (
    bucket_id = 'property-photos' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "Users can delete their own property photos" on storage.objects
  for delete using (
    bucket_id = 'property-photos' and auth.uid()::text = (storage.foldername(name))[1]
  );
```

### 12.3 The object path

The policy expects the **first path segment to be the user id**. That is true for documents
(`app/api/documents/upload/route.ts:30`, `${userId}/…`) and **false** for photos
(`app/api/properties/[id]/photos/route.ts:57`, `property-photos/${userId}/…`). Fix the photo path:

```ts
// app/api/properties/[id]/photos/route.ts:57
const path = `${userId}/${params.id}/${randomUUID()}.${ext}`
```

and upload it to the new bucket with the **authenticated** client, not the service role:

```ts
// app/api/properties/[id]/photos/route.ts:59-70  — replace
const { error: upErr } = await supabase.storage
  .from("property-photos")
  .upload(path, buffer, { contentType: file.type, upsert: false, cacheControl: "3600" })
```

### 12.4 Serving documents: short-lived signed URLs

**Never store a public URL in `documents.file_url`.** Store the **path** and mint a signed URL on
read.

```ts
// lib/storage.ts — add
export async function createSignedUrl(
  userId: string,
  bucket: string,
  path: string,
  expiresInSeconds = 300,
): Promise<string | null> {
  if (!isServiceRoleConfigured()) return null
  try {
    const supa = createServiceClient()!
    // Belt and braces: the path must be inside the caller's own prefix.
    if (!path.startsWith(`${userId}/`)) return null
    const { data } = await supa.storage.from(bucket).createSignedUrl(path, expiresInSeconds)
    return data?.signedUrl ?? null
  } catch {
    return null
  }
}
```

* Upload (`app/api/documents/upload/route.ts:48`): replace `getPublicUrl(path)` with
  `createSignedUrl(userId, "documents", path, 300)` and return **both** the path and the temporary
  URL. Store the **path** in `documents.file_url` (or a new `documents.storage_path` column).
* Read (`app/api/documents/route.ts`, `app/api/documents/[id]/route.ts`): mint a signed URL per
  document, 300 seconds, and return that in the `file_url` field. The client never sees a permanent
  link.
* Delete (`app/api/documents/[id]/route.ts:102-112`): `extractStoragePath` parses
  `/storage/v1/object/public/documents/` — **update it to the signed-URL path form**
  (`/storage/v1/object/sign/documents/`) or, better, store the path in its own column and use that
  directly. The current parser will silently return `null` against a signed URL and the Storage
  object will be orphaned.
* Backups (`lib/storage.ts:26-57`): the backup payload is encrypted before upload (§14.4), and the
  `backups` bucket is private — the existing `createSignedUrl(path, 600)` already works.

### 12.5 Can a signed-in user read another landlord's file by guessing a path?

**Today: yes**, because the bucket is public. **After the change: no**, because

* the bucket is private, so reads require a signed URL, which is minted server-side only after the
  row's `user_id` has been checked; and
* the storage RLS policies scope reads to `storage.foldername(name)[1] = auth.uid()::text`; and
* `createSignedUrl` refuses a path that does not start with the caller's own `${userId}/` prefix.

A landlord who obtains a signed URL for their own document can share it, and it will work until it
expires (300 s). That is the accepted trade-off; a permanent link is not acceptable for identity
documents.

---

## 13. Key rotation

### 13.1 The procedure (master key rotation)

Rotation is **online** and requires no downtime and no schema change.

1. **Generate the new key.**
   ```bash
   openssl rand -base64 32
   ```
2. **Add it to the registry** — do not remove the old key:
   ```json
   { "v1": "<old>", "v2": "<new>" }
   ```
   Deploy. New writes now use `v2` (the highest id); existing `v1:` rows still decrypt.
3. **Re-encrypt the old rows.** Run the rotation job (§13.2) repeatedly until it reports zero
   pending rows. Each row is decrypted with its own key id and re-encrypted under the active key.
4. **Verify.** `SELECT count(*) FROM public.tenants WHERE national_id LIKE 'v1:%'` → 0. Repeat for
   every protected column.
5. **Retire the old key** — only after step 4 is complete and after a full backup has been taken.
   Remove `v1` from the registry and deploy. Rows still written with `v1` will now throw a clear
   `FieldEncryptionError` naming the missing key id, rather than returning garbage.

**Never** remove a key while rows still use it. The failure mode is loud and safe (an exception, not
a silent wrong answer), but it is an outage for that read path.

### 13.2 The rotation job

`scripts/rotate-keys.ts` (and a thin `POST /api/cron/rotate-keys` behind `CRON_SECRET`):

```
for each table in PII_COLUMNS:
    select id, <protected columns> from <table> where <column> like 'v1:%'
    for each row:
        res = decryptFieldWithRotation(value, { context })
        if res.reencrypted: update <table> set <column> = res.reencrypted where id = $id
```

It is idempotent, it is safe to run repeatedly, and it can be run in `--dry-run` mode to count the
work first. It must be **batched** (e.g. 500 rows per statement) and must not hold a transaction
open across the whole table.

### 13.3 Blind-index key rotation

Different procedure, because the index is deterministic and therefore **cannot** be re-derived from
the ciphertext:

1. Register the new blind key: `{"b1": "<old>", "b2": "<new>"}`. Deploy. New rows use `b2`.
2. **Window:** during the transition, lookups must try both. `blindIndexCandidates()` returns one
   candidate per registered key, so the query is
   `WHERE phone_bidx = ANY($1)` with `$1 = blindIndexCandidates(input)`.
3. Re-index: for every row whose `phone_bidx` starts with `b1:`, recompute `b2:` and write both
   values (or just `b2:` and widen the query window for a week).
4. After the re-index completes and no `b1:` values remain, drop `b1` from the registry. Remove the
   `b1:` candidates from the lookup.

### 13.4 Phase 2 — per-tenant keys (not in this cycle)

The published roadmap says "per-tenant encryption keys"
(`app/(marketing)/security/page.tsx:16`). The shape to grow into:

```
tenant DEK (32 bytes, random per tenant)
  → wrapped with the master key (AES-256-GCM, envelope §5)
  → stored in a `tenant_keys` table: { tenant_id, key_id, wrapped_dek }
```

All ciphertext for that tenant uses the tenant DEK; the master key only ever wraps and unwraps.
Compromising the master key then yields nothing without also compromising the `tenant_keys` table,
and a single tenant's DEK can be revoked without touching anyone else. The envelope in §5 already
carries a key id, so this is an additive change to the registry, not a re-encryption of the corpus
— the corpus would need re-encryption once, because the DEK changes per tenant.

**Deferred because** PropDesk's current model is one workspace = one landlord, so the blast radius
of a single master key is "every landlord of the platform". That is a real risk (CRYPTO-007) and it
is the reason §13.4 is on the roadmap rather than finished.

---

## 14. Retention and deletion

### 14.1 The account-deletion routine (CRYPTO-012)

`DELETE /api/account` must remove the user's data across **every** table. The authoritative list of
tables is `BACKUP_TABLES` (`lib/system.ts:22-42`) plus the ones it omits. Use a single query that
discovers the tables rather than a hand-maintained list:

```sql
-- Every table that has a user_id column.
select table_name from information_schema.columns
where table_schema = 'public' and column_name = 'user_id';
```

The routine, in order:

1. `DELETE FROM public.<t> WHERE user_id = $1` for every table with a `user_id` column **and** for
   `user_profiles` (keyed on `user_id` as the primary key) and `app_users` (keyed on `id`).
2. Delete the user's Storage objects: list and remove every object under the `${userId}/` prefix in
   the `documents`, `property-photos` and `backups` buckets.
3. Delete the Supabase Auth user: `supabase.auth.admin.deleteUser(userId)`.
4. Delete the user's backup rows **and their objects**: `backups` rows for the user, plus the objects
   at `backups.storage_path`.
5. Write a **tombstone** — a row with no personal data, so that "this account existed and was
   deleted" is provable without retaining the data:
   ```sql
   insert into public.data_access_audit (user_id, action, resource_type, outcome)
   values ($1, 'delete', 'account', 'ok');
   ```
   (The `user_id` is a uuid, not personal data; if even that is unwanted, store a salted hash of it.)
6. Return a receipt: `{ "deleted_at": "...", "scope": ["properties", "tenants", …] }`.

The UI must then say what actually happened, and the help-centre copy
(`app/(marketing)/help/page.tsx:71-72`) must match: "Settings → Data → Delete account. We delete
within 30 days". Either ship the 30-day SLA (implement it as: delete now, keep nothing) or change
the copy. **Do not ship the copy without the implementation.**

### 14.2 Tenant offboarding (CRYPTO-013)

`DELETE /api/tenants/[id]` (`:80-90`) must redact, not merely orphan:

| Table | Action |
|---|---|
| `documents` where `tenant_id = $1` | delete the row **and** the Storage object |
| `c2b_transactions` where `matched_tenant_id = $1` | decrypt `msisdn` / names and overwrite with a fixed tombstone; redact the `raw` payload |
| `mpesa_transactions` where `tenant_id = $1` | decrypt `phone` and overwrite with a fixed tombstone |
| `notifications` whose `metadata->>'tenant_id' = $1` | delete the row |
| `reconciliation_audit` where `matched_tenant_id = $1` | delete the row |
| `rent_payments` | already cascades (`db/migrations/001-core.sql:101`) — verify |

Redaction (overwrite with a fixed value) rather than deletion where the row is needed for financial
record-keeping — for example a receipt amount — because a Kenyan landlord may have a statutory
retention obligation for rent records. The design keeps the **money** and removes the **identity**.

### 14.3 Subscription-termination purge (CRYPTO-020)

The DPA promises deletion within 90 days of subscription termination. Implement it as: on
`customer.subscription.deleted` / `invoice.payment_failed` → cancel, run the §14.1 routine (or a
"purge after 90 days" job). The simplest correct implementation: a daily cron job that finds
subscriptions cancelled more than 90 days ago and purges them. It must be idempotent.

### 14.4 Backups and exports (CRYPTO-014)

* **Encrypt the backup payload before it is persisted or uploaded.** Use a *dedicated* backup key so
  that rotating the field-encryption key does not require re-encrypting 50 backups per user:
  `PROPDESK_BACKUP_KEY` (32 bytes, base64). The payload is encrypted as one blob:
  ```ts
  const sealed = encryptField(JSON.stringify(payload), { context: `backup:${userId}` })
  await recordBackup(userId, { …, payload: sealed })   // jsonb column now holds an envelope
  ```
  On download (`app/api/backup/[id]/route.ts:21`) and on restore
  (`app/api/backup/import/route.ts:53`), decrypt first.
* **Restore must be decrypt-aware.** A restore currently writes rows back with
  `insert … on conflict do update` (`lib/backup.ts:65-74`). After encryption, a restore that
  writes plaintext into an encrypted column would silently undo the encryption. Either
  (a) the restore re-encrypts with `encryptRow` before writing, or (b) the restore is refused for
  tables with protected columns until it is decrypt-aware. **(a) is the correct answer** — the
  backup payload is encrypted as a blob, so the restore decrypts the blob and then re-encrypts the
  individual fields with `encryptRow`.
* **The CSV/JSON export must show real data**, not envelopes: `decryptRow` per table in
  `app/api/export/route.ts` and `app/api/backup/csv/[table]/route.ts`.
* **`sanitiseRow` (`lib/system.ts:145-152`) should also drop the raw M-Pesa payloads** (`raw`,
  `raw_response`, `raw_callback`) from a backup — they duplicate PII that is already protected in
  the dedicated columns and there is no reason to carry them.

### 14.5 Retention schedule to publish

| Data | Retention | Basis |
|---|---|---|
| Tenant national ID | Life of the tenancy + 12 months | Landlord's own record-keeping need |
| Tenant phone / email | Life of the tenancy + 12 months | |
| Identity documents | Life of the tenancy + 12 months, then deleted | |
| M-Pesa transaction records | 7 years | Kenyan accounting/tax expectation |
| Audit log | 24 months | Balance of evidentiary value against the PII it describes |
| Backups | 50 most recent per user (current) — but encrypted | |
| Notifications | 12 months | |
| Account deletion | Immediate, with a non-identifying tombstone | |

---

## 15. Audit logging (CRYPTO-015)

### 15.1 The table

`data_access_audit` — the DDL is in §11.4. The columns, and what each one is for:

| Column | Content | Why |
|---|---|---|
| `id` | uuid | Primary key. |
| `user_id` | uuid of the actor | **The point of the log.** |
| `actor_role` | `user` \| `service` \| `system` | Distinguishes a human from the cron job. |
| `action` | `read` \| `write` \| `export` \| `download` \| `delete` | |
| `resource_type` | `tenants` \| `documents` \| `c2b_transactions` \| `export` \| `backup` \| … | |
| `resource_id` | the row uuid, or NULL for a bulk read | |
| `outcome` | `ok` \| `denied` \| `error` | |
| `request_id` | the request id from the API layer | Correlates with the application logs. |
| `ip_hash` | `sha256(ip + dailyRotatingSalt)` | The raw IP is personal data too; a per-day salt lets you correlate a session within a day without retaining the address. |
| `row_count` | number of rows touched | For bulk reads, so "read 4,318 tenants" is distinguishable from "read 1 tenant". |
| `created_at` | timestamptz | |

### 15.2 What to log — and what never to log

**Log:** the fact that a read happened, who did it, which resource, how many rows, and when.

**Never log:** the value. No national ID, no phone number, no email, no name, no MSISDN, no
ciphertext, no key id (the key id is not secret, but it is not useful either), no request body, no
response body. An audit log that stores the PII it is auditing is a second copy of the PII — it
would have to be encrypted, retained, searched and deleted on the same schedule, which defeats the
point of having it.

**Corollary:** the audit table must never be included in a backup payload, and its own retention
(24 months) must be enforced by a job, not by hope.

### 15.3 Where to write it

One choke point, so it cannot be forgotten:

* `lib/api/index.ts` → `withAuth` — wrap the handler; on a successful `GET` of a sensitive table,
  write a `read` row.
* `lib/api/with-db-auth.ts` → `withDbAuth` — same.
* The export and backup routes — write an `export` / `backup` row with the row count.
* The signed-URL endpoint — write a `download` row with the `resource_id` of the document.

A minimal implementation: add a `sensitive?: boolean` and `resourceType?: string` option to the
route wrappers, and have the wrapper emit the audit row after the handler returns. The route
registers what it touches; the wrapper owns the format, the sanitisation and the failure handling.

**The audit write must not break the request.** Wrap it in `try/catch` and log (not throw) a
failure — an audit outage must not take the product down. But an audit write that fails silently
forever is useless, so also count failures in the `/api/system/health` response.

### 15.4 Retention

24 months, then hard delete via a daily job:

```sql
delete from public.data_access_audit where created_at < now() - interval '24 months';
```

---

## 16. Legal-page corrections (do these in the same cycle)

These are one-paragraph edits to four pages. They are cheap and they remove false statements from
the public site.

| File:line | Current claim | Change to |
|---|---|---|
| `app/(marketing)/legal/privacy/page.tsx:51-53` | "stored in our Supabase (PostgreSQL) project, hosted on AWS … We use Supabase's row-level security…" | "Your data is stored in a managed **Neon** Postgres database, with identity documents and photos in **Supabase Storage** private buckets. Records are scoped per account in the application layer and each account's sensitive fields are encrypted with AES-256-GCM before they are written." |
| `app/(marketing)/legal/privacy/page.tsx:52` | "Backups are encrypted at rest and in transit." | "Backups are encrypted at rest and in transit." — **only** once §14.4 ships. Until then: "Backups are stored encrypted at rest by our infrastructure provider and, from the next release, encrypted again by PropDesk before they are written." |
| `app/(marketing)/legal/privacy/page.tsx:67-73` | "You can export, correct or delete your data at any time from Settings → Data." | Keep **only** if §14.1 ships. Otherwise: "You can export or correct your data at any time from Settings → Data. To delete your account, email us and we will action it within 30 days." |
| `app/(marketing)/legal/privacy/page.tsx:31-38` | "What we collect" | Add the emergency-contact details and the third-party payer details (CRYPTO-022, CRYPTO-003). |
| `app/(marketing)/legal/dpa/page.tsx:73-79` | Sub-processor list: "Supabase (PostgreSQL hosting) — primary database"; "Amazon Web Services — backup storage" | Add **Neon** (primary database, with its region) and correct the backup-storage vendor to Supabase Storage. Keep the 30-day notification promise. |
| `app/(marketing)/legal/dpa/page.tsx:82-88` | "encryption in transit and at rest, row-level security, audit logging" | "encryption in transit, application-layer encryption of tenant personal data, and audit logging of access to sensitive records." Remove "row-level security" unless RLS is deployed on Neon (CRYPTO-016 option (b)). |
| `app/(marketing)/legal/dpa/page.tsx:99-105` | "EU (Frankfurt) and Kenya (Nairobi) … region locking on Agency and Enterprise plans" | State the actual Neon region, or drop the region-locking claim until it is implemented. |
| `app/(marketing)/legal/dpa/page.tsx:114-120` | "Within 90 days of subscription termination … delete all personal data" | Keep **only** if §14.3 ships. |
| `app/(marketing)/security/page.tsx:16` | "TLS 1.3 in transit. AES-256 at rest. Per-tenant encryption keys in our roadmap." | "TLS 1.3 in transit. Application-layer AES-256-GCM encryption of tenant national ID numbers, phone numbers and payment identifiers. Per-tenant encryption keys are on our roadmap." |
| `app/(marketing)/help/page.tsx:68,71-72` | "Supabase (PostgreSQL) on AWS, in the EU (Frankfurt) and Kenya (Nairobi) regions…"; "Settings → Data → Delete account. We delete within 30 days" | Match the privacy page exactly. |

**Rule:** a published claim must be true at the moment it is published. If the implementation is not
in the same release as the copy, the copy changes first.

---

## 17. Rollout order

Each phase is independently shippable and reversible. Do not start a phase until the previous one is
green in production.

| Phase | Content | Gate |
|---|---|---|
| **0** | Move the sensitive reads behind the server (CRYPTO-025). No encryption yet — this is a pure refactor. | `grep -rn 'from("tenants")' app/dashboard` finds no client component. The dashboard still works. |
| **1** | Ship `lib/crypto/field-encryption.ts` + `lib/crypto/pii-columns.ts` + `db/migrations/003-pii-encryption.sql` + the env vars + `scripts/backfill-encryption.ts` (**dry-run only**). Nothing calls `encryptField` yet. | The migration applies cleanly; the backfill's dry run reports the expected row counts; `/api/system/health` reports the key as configured. |
| **2** | Switch the **write** paths on (§11.2). New rows are encrypted; old rows are still plaintext. `decryptField` passes legacy plaintext through, so the UI keeps working. | A newly created tenant has `national_id LIKE 'v1:%'` and the UI shows the real value. Existing tenants are unaffected. |
| **3** | Switch the **read** paths on (§11.3) and the blind-index lookups (`paybills.number_bidx`, `tenants.phone_bidx`). | A C2B payment still reconciles to the right tenant (§19.4 is the acceptance test). |
| **4** | Run the backfill for real (`scripts/backfill-encryption.ts --apply`). | `SELECT count(*) FROM tenants WHERE national_id NOT LIKE 'v1:%' AND national_id IS NOT NULL` → 0. The UI still shows real values for every tenant. |
| **5** | Storage: private buckets, policies, signed URLs, the photo-path fix. | The tenant document opens through a 300-second signed URL; a landlord cannot read another landlord's document by guessing a path. |
| **6** | Deletion: `DELETE /api/account`, the tenant-redaction sweep, the termination purge. Backups encrypted. | The deletion test in §19.5 passes. |
| **7** | Audit log: the table, the write path, the retention job. | Every read of a sensitive table appears in `data_access_audit`. |
| **8** | Secret comparisons (§10.3), service-role pruning (§10.4). | `grep -rn "SECRET" app/api` shows no `===` / `!==` comparison of a secret. |
| **9** | Legal-page corrections (§16). | The pages match the implementation. |
| **10** | Key rotation rehearsal: register `v2`, re-encrypt, retire `v1`. | A row written before the rotation decrypts correctly afterwards. |

**Rollback:** every phase is reversible by redeploying the previous build, except phase 4 (the
backfill). The backfill is reversible **only** if the plaintext is recoverable — it is not, once
encrypted. Therefore: **take a verified backup immediately before phase 4**, and run the backfill in
batches with a row-count check after each batch.

---

## 18. Test plan

### 18.1 `lib/crypto/field-encryption.test.ts` (vitest — the repo already has vitest 5.0.1)

The 35 assertions in the reference smoke test become the test file. Required cases:

1. Round trip: `decryptField(encryptField(v)) === v` for ASCII, emoji, a 10 KB string and `""`.
2. `null` / `undefined` in → `null` out; `""` → an envelope that round-trips to `""`.
3. The envelope has exactly four segments; iv = 12 bytes; tag = 16 bytes; ciphertext length =
   plaintext length.
4. Two encryptions of the same value differ (random IV).
5. A wrong `context` fails to authenticate.
6. A tampered ciphertext fails to authenticate.
7. A tampered auth tag fails to authenticate.
8. An unknown key id throws a `FieldEncryptionError` naming the key id.
9. A legacy plaintext value passes through `decryptField` unchanged and is flagged by
   `decryptFieldWithRotation` for re-encryption.
10. `decryptFieldWithRotation` re-encrypts under the new active key and reports the old key id.
11. `blindIndex` is deterministic, normalisation-independent, and does not contain the plaintext.
12. `blindIndexCandidates` returns one value per registered key.
13. `timingSafeEqualString` is true for equal strings, false for different ones, false (and does not
    throw) for different lengths and for `null`.
14. A key that is not 32 bytes throws.
15. A malformed registry throws.
16. `normalizePhoneE164` produces the same result as `lib/mpesa/daraja.ts` `normalizePhone` for
    `0712345678`, `+254712345678`, `254712345678`, `712345678` and `254 712 345 678`.

### 18.2 Integration tests

* A tenant created through `POST /api/tenants` has an encrypted `national_id` in the database and a
  plain national ID in the API response.
* `GET /api/tenants/:id` returns the plain national ID.
* A C2B validation request for a known tenant's phone matches via the blind index; a request for an
  unknown phone does not; **and neither query touches another landlord's rows**.
* A C2B confirmation for a known paybill number resolves the landlord via `paybills.number_bidx`.
* `GET /api/export?format=json` contains the plain national ID, not an envelope.
* A backup payload stored in `backups.payload` does **not** contain the string `national_id` in
  clear text; restoring it reproduces the plain value.
* `DELETE /api/account` leaves zero rows for that user in every table listed by
  `information_schema`, zero Storage objects, and zero backup rows.

### 18.3 Static checks (add to CI)

```bash
# No plaintext secret comparisons left.
grep -rnE "(secret|SECRET|passkey|password)\s*(===|!==)" app lib | grep -v node_modules
# No envelope may reach the client un-decrypted.
grep -rn "national_id" app/api | grep -v decrypt
# The key must never be a public env var.
grep -rn "NEXT_PUBLIC_.*\(ENCRYPTION\|SECRET\|KEY\)" . --include=*.ts --include=*.tsx
```

---

## 19. Acceptance criteria

1. `SELECT national_id FROM public.tenants` returns only `v1:…` envelopes (or NULL).
2. `SELECT * FROM public.backups` contains no clear-text national ID, phone number or MSISDN.
3. `GET /api/export?format=json` contains the landlord's real values.
4. A C2B payment for a known tenant's phone is still accepted and still reconciles.
5. A landlord cannot read another landlord's document by guessing a path, and the `documents` bucket
   is private.
6. `timingSafeEqualString` is used for all four app secrets; no `===` comparison of a secret remains.
7. `DELETE /api/account` removes the user's data from every table, from Storage and from the
   backups, and leaves a tombstone.
8. Every read of a sensitive table produces a `data_access_audit` row that contains no PII.
9. The public legal pages make no claim that the code does not implement.
10. The encryption key can be rotated online with no downtime and no schema change.

---

## 20. Known risks of this design

| Risk | Mitigation |
|---|---|
| The master key in an environment variable is a single point of compromise for the whole platform. | §13.4 (per-tenant DEKs) is the planned answer; until then, keep the key in a secrets manager with strict access, and rotate it on a schedule. |
| Free text can still hold PII. | §8 — the scrubber, plus the privacy page's honest description of what is collected. |
| The blind-index key enables offline dictionary attacks on phone numbers. | Keep it separate from the encryption key, rotate it, and treat a blind-index leak as a partial PII breach. |
| A half-migrated table is valid but **mixed**: some rows plaintext, some encrypted. | `decryptField` handles both, the backfill is idempotent, and §17 phase 4 verifies zero plaintext rows before the phase is closed. |
| A key id removed too early throws on read. | The error is loud and names the key id; the rotation procedure (§13.1) forbids it. |
| The Neon path and the Supabase path diverge (CRYPTO-022, CRYPTO-025). | Phase 0 forces every sensitive read through the server, which collapses the two paths for the sensitive tables. |
| Blind-index normaliser drift breaks lookups silently. | One implementation (`normalizePhoneE164`), with a test that compares it to the existing `normalizePhone`. |
| Encryption makes the export/backup paths non-trivial. | §14.4 specifies the backup key, the decrypt-on-download and the decrypt-aware restore. |

---

## 21. Open questions for the owner

These do not block the build; they change what the copy says.

1. **How long must a landlord keep a former tenant's records?** The design assumes 12 months after
   the tenancy ends. Kenya's tax and accounting rules for rent records are the reason to check.
2. **Is a 30-day account-deletion SLA acceptable, and is a hard delete acceptable, or must a
   tombstone be kept?** §14.1 keeps a non-identifying tombstone.
3. **Which Neon region is production in?** The DPA's residency clause has to name it.
4. **Do enterprise/agency customers actually need per-tenant keys now?** That decides whether §13.4
   moves from Phase 2 to this cycle.
