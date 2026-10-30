import { timingSafeEqual } from "node:crypto"

/**
 * Constant-time secret comparison.
 *
 * `crypto.timingSafeEqual` THROWS when the two buffers have different lengths,
 * so the length guard has to come first. The guard leaks only the *length* of
 * the two values, which is not secret for the environment secrets used in this
 * codebase and is unavoidable for any byte-wise comparison.
 *
 * Both operands are always materialised as buffers before being compared, so
 * the function never short-circuits on content.
 *
 * Use this INSTEAD of `===` for anything that compares a user-supplied value
 * against a server-side secret (MIGRATION_SECRET, CRON_SECRET,
 * BACKUP_CRON_SECRET, MPESA_CALLBACK_SECRET, webhook secrets).
 */
export function timingSafeEqualString(a: string | null | undefined, b: string | null | undefined): boolean {
  // Normalise undefined/null to "" so a missing header can never compare
  // equal to a missing secret.
  const left = Buffer.from(a ?? "", "utf8")
  const right = Buffer.from(b ?? "", "utf8")

  if (left.length !== right.length) return false
  if (left.length === 0) return true

  return timingSafeEqual(left, right)
}
