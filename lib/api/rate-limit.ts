/**
 * In-memory fixed-window rate limiter.
 *
 * Used to throttle the PUBLIC write endpoints (newsletter, contact, lead
 * capture, feedback, support, customer-request votes). Without it any
 * anonymous visitor can flood the marketing tables or use the platform as a
 * spam relay.
 *
 * KNOWN LIMITATION — read this before relying on it:
 * This is a per-instance, in-memory counter. On Vercel each serverless
 * instance has its own memory, so the effective limit is (limit x number of
 * concurrent instances). It is a meaningful speed bump, not a hard guarantee.
 * The production fix is a shared store (Vercel KV / Upstash Redis) behind the
 * same interface — swap the implementation of `checkRateLimit` and the
 * call sites do not change.
 *
 * The limiter is deliberately dependency-free: no new packages, no build
 * steps, and it works on the Edge and Node runtimes alike.
 */

type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

/** How often to sweep expired buckets. */
const SWEEP_INTERVAL_MS = 60_000

let lastSweep = Date.now()

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return
  lastSweep = now
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

export interface RateLimitResult {
  ok: boolean
  limit: number
  remaining: number
  /** Seconds until the current window resets. */
  resetInSeconds: number
}

/**
 * Count one request against `key` and report whether it is allowed.
 *
 * @param key     an opaque identity for the caller (usually IP + purpose)
 * @param limit   max requests allowed per window
 * @param windowMs window length in milliseconds
 */
export function checkRateLimit(key: string, limit: number, windowMs = 60_000): RateLimitResult {
  const now = Date.now()
  sweep(now)

  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, limit, remaining: limit - 1, resetInSeconds: Math.ceil(windowMs / 1000) }
  }

  existing.count += 1
  const remaining = Math.max(0, limit - existing.count)
  return {
    ok: existing.count <= limit,
    limit,
    remaining,
    resetInSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  }
}

/**
 * Best-effort client IP for rate-limiting purposes.
 *
 * Reads the platform-provided header when available and falls back to the
 * first `x-forwarded-for` entry. NOTE: a forwarded header is client
 * controllable, so it is only ever used to make abuse *harder*, never to
 * authorise anything.
 */
export function clientIdentifier(request: {
  headers: { get(name: string): string | null }
}): string {
  const headers = request.headers
  const direct =
    headers.get("x-vercel-forwarded-for") ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip")
  if (direct) return direct.trim()

  const forwarded = headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first
  }
  return "unknown"
}

/** Test helper — clears all counters. */
export function resetRateLimits(): void {
  buckets.clear()
}
