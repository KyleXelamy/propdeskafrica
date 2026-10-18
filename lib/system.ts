/**
 * PropDesk Africa system library.
 *
 * Self-contained backup + patch/update system. No admin panel.
 * The platform can:
 *   - export itself as JSON or per-table CSV
 *   - restore from an exported backup
 *   - apply numbered patches (SQL or in-code) that update the schema,
 *     seed data, or migrate data between columns
 *   - report its own version + applied patch log
 *
 * Designed so that a fresh install can be patched to the same state
 * as any production instance by replaying the patch log.
 */

import { z } from "zod"

// ====================================================================
// Tables we know how to back up. Adding a new table? Add it here.
// ====================================================================

export const BACKUP_TABLES = [
  "properties",
  "tenants",
  "rent_payments",
  "expenses",
  "maintenance_requests",
  "notes",
  "documents",
  "notifications",
  "recurring_expenses",
  "document_expiry_reminders",
  "paybills",
  "c2b_transactions",
  "quotations",
  "damages",
  "contacts",
  "reconciliation_rules",
  "reconciliation_audit",
  "property_photos",
  "user_profiles",
] as const

export type BackupTable = (typeof BACKUP_TABLES)[number]

// ====================================================================
// Versioning
// ====================================================================

/**
 * Bump this when you ship a schema migration. It's compared against
 * the `system_version.schema_version` row in the DB. When lower, the
 * patch runner knows there are migrations to apply.
 */
export const CURRENT_SCHEMA_VERSION = 15

export const APP_VERSION = "5.0.0"
export const APP_NAME = "PropDesk Africa"
export const APP_COMMIT = process.env.NEXT_PUBLIC_APP_COMMIT ?? "dev"

export interface PatchDescriptor {
  id: string
  description: string
  /** Path to the SQL file (relative to /supabase-setup) */
  sql?: string
  /** In-code migration function */
  fn?: "init-views" | "backfill-property-coords" | "normalize-phones"
  /** Can the patch be rolled back? */
  reversible?: boolean
  kind?: "schema" | "data" | "config" | "security"
}

/**
 * The canonical patch log. The runner iterates this list top-to-bottom
 * on every server boot, applying any patch not yet recorded in the
 * `patches` table. This means a fresh checkout becomes production-ready
 * by just running `npm start`.
 */
export const PATCH_LOG: PatchDescriptor[] = [
  { id: "p_2024_02_001", description: "Initial schema (properties, tenants, payments, expenses)", sql: "01-create-tables.sql", kind: "schema" },
  { id: "p_2024_02_002", description: "Add missing columns", sql: "02-add-missing-columns.sql", kind: "schema" },
  { id: "p_2024_03_001", description: "Notifications system", sql: "03-notifications.sql", kind: "schema" },
  { id: "p_2024_04_001", description: "Property photos", sql: "04-property-photos.sql", kind: "schema" },
  { id: "p_2024_05_001", description: "Recurring expenses", sql: "05-recurring-expenses.sql", kind: "schema" },
  { id: "p_2024_06_001", description: "Document expiry reminders", sql: "06-document-expiry.sql", kind: "schema" },
  { id: "p_2024_07_001", description: "Maintenance reminders", sql: "07-maintenance-reminders.sql", kind: "schema" },
  { id: "p_2024_08_001", description: "Tenant portal (deprecated — superseded by tenant-records)", sql: "08-tenant-portal.sql", kind: "schema", reversible: true },
  { id: "p_2024_09_001", description: "M-Pesa STK Push + transaction log", sql: "09-mpesa.sql", kind: "schema" },
  { id: "p_2026_10_001", description: "Holy grail: paybills, C2B, quotations, damages, companies, reconciliation", sql: "10-holy-grail.sql", kind: "schema" },
  { id: "p_2026_10_002", description: "Backup + patch system: backups, backup_runs, restore_runs, system_version, patches", sql: "11-backup-patch.sql", kind: "schema" },
  { id: "p_2026_10_003", description: "Seed system_health() helper", fn: "init-views", kind: "config" },
  { id: "p_2026_10_004", description: "Auto-backup: per-user schedule + prune_old_backups() function", sql: "12-auto-backup.sql", kind: "config" },
  { id: "p_2026_10_005", description: "Atomic bump_paybill_counters() RPC for C2B confirmation", sql: "13-paybill-counters.sql", kind: "config" },
  { id: "p_2026_10_006", description: "Subscriptions: plans + per-user subscription + trial", sql: "14-subscriptions.sql", kind: "schema" },
  { id: "p_2026_10_007", description: "Subscription payments: per-user STK push intents for plans", sql: "15-subscription-payments.sql", kind: "schema" },
  { id: "p_2026_10_008", description: "Schema repair: add columns missing on databases deployed before them", sql: "15-repair-live-schema.sql", kind: "schema" },
  { id: "p_2026_10_009", description: "Single-price plan: 14-day trial, then KES 2,490/month Pro for every portfolio size", sql: "16-plans-single-price.sql", kind: "config" },
  { id: "p_2026_10_010", description: "Payment hardening: one plan, idempotency, callback fields and Stripe checkout", sql: "16-payment-hardening.sql", kind: "schema" },
]

export function describePatches(): Array<{ id: string; description: string; kind: string }> {
  return PATCH_LOG.map((p) => ({ id: p.id, description: p.description, kind: p.kind ?? "schema" }))
}

// ====================================================================
// Backup schemas
// ====================================================================

export const BackupPayloadSchema = z.object({
  schema_version: z.number().int().nonnegative(),
  app_version: z.string(),
  generated_at: z.string(), // ISO
  user: z.object({
    id: z.string(),
    email: z.string().optional(),
  }),
  counts: z.record(z.string(), z.number()),
  data: z.record(z.string(), z.array(z.record(z.any()))),
})

export type BackupPayload = z.infer<typeof BackupPayloadSchema>

/**
 * Sanitised row — a row from any table, with unknown columns stripped to
 * stop backups leaking secrets or schema internals.
 */
export type SanitisedRow = Record<string, unknown>

/**
 * Fields we always strip from any backup. Add to this list over time.
 */
const NEVER_BACKUP = new Set([
  "password",
  "password_hash",
  "token",
  "encrypted_password",
  "session_token",
  "refresh_token",
  "secret",
  "api_key",
  "private_key",
  "access_token",
])

export function sanitiseRow(row: Record<string, unknown>): SanitisedRow {
  const out: SanitisedRow = {}
  for (const [k, v] of Object.entries(row)) {
    if (NEVER_BACKUP.has(k.toLowerCase())) continue
    out[k] = v
  }
  return out
}

// ====================================================================
// Restore schemas
// ====================================================================

export const RestoreOptionsSchema = z.object({
  /** Which tables to restore. Empty = all. */
  tables: z.array(z.string()).optional(),
  /** Conflict policy: 'skip' leaves existing rows alone, 'replace' overwrites, 'merge' upserts. */
  on_conflict: z.enum(["skip", "replace", "merge"]).default("skip"),
  /** Dry-run returns counts without writing. */
  dry_run: z.boolean().default(false),
  /** When true, don't restore 'id' columns — let the DB assign new ones. */
  remap_ids: z.boolean().default(false),
})

export type RestoreOptions = z.infer<typeof RestoreOptionsSchema>

export interface RestoreResult {
  status: "success" | "partial" | "failed"
  before_counts: Record<string, number>
  after_counts: Record<string, number>
  tables_restored: string[]
  errors?: Array<{ table: string; error: string }>
}

// ====================================================================
// Format helpers
// ====================================================================

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

/**
 * Build a JSON backup filename: `propdeskafrica-backup-{YYYY-MM-DD}.json`
 */
export function backupFilename(prefix = "propdeskafrica-backup"): string {
  const d = new Date()
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(d.getUTCDate()).padStart(2, "0")
  return `${prefix}-${yyyy}-${mm}-${dd}.json`
}

/**
 * Convert a record array to CSV. Minimal but safe enough for our shapes.
 */
export function toCSV(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return ""
  const headers = Array.from(
    rows.reduce<Set<string>>((set, r) => {
        for (const k of Object.keys(r)) set.add(k)
        return set
      }, new Set<string>()),
  )
  const escape = (v: unknown): string => {
    if (v == null) return ""
    const s = typeof v === "string" ? v : JSON.stringify(v)
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return '"' + s.replace(/"/g, '""') + '"'
    }
    return s
  }
  const lines = [headers.join(",")]
  for (const r of rows) {
    lines.push(headers.map((h) => escape(r[h])).join(","))
  }
  return lines.join("\n")
}
