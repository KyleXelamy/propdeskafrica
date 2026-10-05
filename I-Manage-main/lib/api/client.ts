import type { ApiError } from "./types"

interface ApiCallOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
  body?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
}

export class ApiError extends Error {
  status: number
  body: any
  constructor(message: string, status: number, body: any) {
    super(message)
    this.status = status
    this.body = body
  }
}

/**
 * Tiny client-side wrapper around fetch for /api/* endpoints.
 * - Throws ApiError on non-2xx so callers can `.catch` cleanly.
 * - Always sends `same-origin` credentials so the user's cookie flows.
 * - Sends JSON body with the right content-type automatically.
 *
 * Usage:
 *   const data = await apiFetch("/api/properties", { method: "POST", body: formData })
 *   // → data is the parsed JSON response; on error throws ApiError
 */
export async function apiFetch<T = any>(path: string, opts: ApiCallOptions = {}): Promise<T> {
  const { method = "GET", body, headers, signal } = opts
  const init: RequestInit = {
    method,
    credentials: "same-origin",
    headers: {
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    signal,
  }
  if (body !== undefined) init.body = JSON.stringify(body)
  const res = await fetch(path, init)
  const text = await res.text()
  let parsed: any = null
  if (text) {
    try { parsed = JSON.parse(text) } catch { parsed = text }
  }
  if (!res.ok) {
    const msg = (parsed && typeof parsed === "object" && parsed.error) || `Request failed (${res.status})`
    throw new ApiError(msg as string, res.status, parsed)
  }
  return parsed as T
}

/** Convenience for delete-with-redirect. Returns true on success. */
export async function apiDelete(path: string): Promise<void> {
  await apiFetch(path, { method: "DELETE" })
}

export type { ApiError as ApiErrorType, ApiCallOptions }
