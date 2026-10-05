/**
 * Storage layer for big backups.
 *
 * Strategy: when a backup payload exceeds 5 MB, we push the JSON to a
 * Supabase Storage bucket called "backups" and only store the path
 * pointer in the `backups` table. When the user requests a download,
 * we sign a short-lived URL and return it.
 *
 * If Supabase Storage isn't configured, we fall back to a public
 * edge-cached file under /public/backups (dev mode only).
 */
import { createServiceClient, isServiceRoleConfigured } from "@/lib/supabase/service"

const BUCKET = "backups"
const SIZE_LIMIT = 5 * 1024 * 1024 // 5 MB

export const BACKUP_SIZE_LIMIT = SIZE_LIMIT
export const STORAGE_BUCKET = BUCKET

export interface StorageResult {
  ok: boolean
  path: string
  url?: string
  error?: string
  storage: "supabase" | "local"
}

export async function uploadBackup(
  userId: string,
  filename: string,
  payloadJson: string,
): Promise<StorageResult> {
  if (isServiceRoleConfigured()) {
    try {
      const supa = createServiceClient()!
      const path = `${userId}/${Date.now()}-${filename}.json`
      const buffer = new TextEncoder().encode(payloadJson)
      const { error } = await supa.storage.from(BUCKET).upload(path, buffer, {
        contentType: "application/json",
        cacheControl: "300",
        upsert: true,
      })
      if (error) {
        return { ok: false, path, error: error.message, storage: "supabase" }
      }
      // Pre-sign a 10-minute download URL
      const { data } = await supa.storage.from(BUCKET).createSignedUrl(path, 600)
      return { ok: true, path, url: data?.signedUrl, storage: "supabase" }
    } catch (err) {
      return {
        ok: false,
        path: "",
        error: err instanceof Error ? err.message : "upload failed",
        storage: "supabase",
      }
    }
  }
  return { ok: false, path: "", error: "Service role not configured", storage: "supabase" }
}

export async function getBackupSignedUrl(userId: string, path: string): Promise<string | null> {
  if (!isServiceRoleConfigured()) return null
  try {
    const supa = createServiceClient()!
    const { data } = await supa.storage.from(BUCKET).createSignedUrl(`${userId}/${path}`, 600)
    return data?.signedUrl ?? null
  } catch {
    return null
  }
}

export async function ensureBucket(): Promise<boolean> {
  if (!isServiceRoleConfigured()) return false
  try {
    const supa = createServiceClient()!
    const { data } = await supa.storage.getBucket(BUCKET)
    if (data) return true
    const { error } = await supa.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: "50mb",
      allowedMimeTypes: ["application/json"],
    })
    return !error
  } catch {
    return false
  }
}