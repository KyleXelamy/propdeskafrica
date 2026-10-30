import { withAuth, successResponse, errorResponse, pickFields, blankToNull, toNumberOrNull, HttpError } from "@/lib/api"
import { createServiceClient } from "@/lib/supabase/service"
import type { SupabaseClient } from "@supabase/supabase-js"

const DOCUMENT_FIELDS = [
  "name",
  "title",
  "type",
  "document_type",
  "file_url",
  "file_size",
  "mime_type",
  "property_id",
  "tenant_id",
  "category",
  "notes",
  "expiry_date",
  "reminder_days_before",
] as const

/**
 * The `documents` bucket is PRIVATE (CRYPTO-005 / INFRA-013).
 *
 * `documents.file_url` stores the Storage OBJECT PATH
 * (`{userId}/{timestamp}-{name}.{ext}`), not a public URL. Reads are served
 * with a 5 minute signed URL that is only ever issued for an object inside
 * the caller's own folder.
 */
const BUCKET = "documents"
const SIGNED_URL_TTL_SECONDS = 300

/**
 * Normalises a stored `file_url` into a Storage object path. Accepts the
 * new path format and the legacy public URL format so existing rows keep
 * working while the data is migrated.
 */
function toStoragePath(value: unknown): string | null {
  if (typeof value !== "string") return null
  const raw = value.trim()
  if (!raw) return null
  if (/^https?:\/\//i.test(raw)) {
    const marker = "/storage/v1/object/public/documents/"
    const idx = raw.indexOf(marker)
    if (idx === -1) return null
    try {
      return decodeURIComponent(raw.slice(idx + marker.length)).replace(/^\/+/, "")
    } catch {
      return null
    }
  }
  return raw.replace(/^\/+/, "")
}

/**
 * Issues a short-lived signed URL for an object that belongs to `userId`.
 * The path must sit inside the caller's own folder — that is what binds
 * the signed URL to the requesting owner.
 */
async function createOwnerSignedUrl(
  supabase: SupabaseClient,
  userId: string,
  path: string,
): Promise<string | null> {
  if (!path.startsWith(`${userId}/`)) return null
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
    if (!error && data?.signedUrl) return data.signedUrl
    console.warn("[api/documents/:id] storage refused to sign object", error?.message)
  } catch (err) {
    console.warn("[api/documents/:id] signed url failed", err)
  }
  const admin = createServiceClient()
  if (!admin) return null
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  if (error || !data?.signedUrl) {
    console.warn("[api/documents/:id] signed url (service role) failed", error?.message)
    return null
  }
  return data.signedUrl
}

export const GET = withAuth(async (_req, { supabase, userId }, params) => {
  const { data, error } = await supabase
    .from("documents")
    .select("*, properties(name, address), tenants(full_name)")
    .eq("id", params.id)
    .eq("user_id", userId)
    .single()

  if (error) return errorResponse("Document not found", 404)

  const path = toStoragePath((data as any)?.file_url)
  const signedUrl = path ? await createOwnerSignedUrl(supabase, userId, path) : null
  return successResponse({
    ...(data as any),
    storage_path: path,
    file_url: signedUrl,
  })
})

export const PUT = withAuth(async (req, { supabase, userId }, params) => {
  const body = await req.json().catch(() => null)
  const fields = pickFields<Record<string, any>>(body, DOCUMENT_FIELDS)

  if (Object.keys(fields).length === 0) {
    throw new HttpError("No fields to update", 400)
  }

  const update: Record<string, any> = { ...fields }
  if (fields.title !== undefined && fields.name === undefined) {
    update.name = blankToNull(fields.title)
  }
  if (fields.document_type !== undefined && fields.type === undefined) {
    update.type = blankToNull(fields.document_type)
  }
  if (fields.property_id !== undefined) update.property_id = blankToNull(fields.property_id)
  if (fields.tenant_id !== undefined) update.tenant_id = blankToNull(fields.tenant_id)
  if (fields.notes !== undefined) update.notes = blankToNull(fields.notes)
  if (fields.file_size !== undefined) update.file_size = toNumberOrNull(fields.file_size)
  if (fields.expiry_date !== undefined) update.expiry_date = blankToNull(fields.expiry_date)
  if (fields.reminder_days_before !== undefined) {
    update.reminder_days_before = Math.max(0, Math.min(365, Number(fields.reminder_days_before) || 30))
  }
  if (fields.file_url !== undefined) {
    // `file_url` holds a storage object path, never a URL. A client that
    // round-trips the signed URL it was given must not be able to persist
    // an expiring token (or point the row at somebody else's object), so
    // only an in-folder path is accepted — anything else keeps the
    // currently stored object.
    const path = toStoragePath(fields.file_url)
    if (path && path.startsWith(`${userId}/`)) {
      update.file_url = path
    } else {
      delete update.file_url
    }
  }

  const { data, error } = await supabase
    .from("documents")
    .update(update)
    .eq("id", params.id)
    .eq("user_id", userId)
    .select("*, properties(name, address), tenants(full_name)")
    .single()

  if (error) return errorResponse(error.message, 500)
  if (!data) return errorResponse("Document not found", 404)

  const path = toStoragePath((data as any)?.file_url)
  const signedUrl = path ? await createOwnerSignedUrl(supabase, userId, path) : null
  return successResponse({
    ...(data as any),
    storage_path: path,
    file_url: signedUrl,
  })
})

export const DELETE = withAuth(async (_req, { supabase, userId }, params) => {
  // First fetch the row so we can clean up the Storage object afterwards.
  const { data: doc } = await supabase
    .from("documents")
    .select("file_url")
    .eq("id", params.id)
    .eq("user_id", userId)
    .single()

  if (!doc) return errorResponse("Document not found", 404)

  const { error, count } = await supabase
    .from("documents")
    .delete({ count: "exact" })
    .eq("id", params.id)
    .eq("user_id", userId)

  if (error) return errorResponse(error.message, 500)

  // Best-effort storage cleanup — ignore errors here.
  const path = toStoragePath((doc as any)?.file_url)
  if (path) {
    try {
      // The user-scoped client is subject to the storage RLS policies, so
      // this can only remove an object inside the caller's own folder.
      await supabase.storage.from(BUCKET).remove([path])
    } catch (e) {
      console.warn("[api] storage cleanup failed", e)
    }
  }

  return successResponse({ success: true, deleted: count })
})
