import { withAuth, successResponse, errorResponse, pickFields, blankToNull, toNumberOrNull, HttpError } from "@/lib/api"
import { createServiceClient } from "@/lib/supabase/service"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { NextRequest } from "next/server"

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
 * `documents.file_url` therefore stores the Storage OBJECT PATH
 * (`{userId}/{timestamp}-{name}.{ext}`) — never a public URL — and every
 * read hands the caller a SHORT-LIVED signed URL for an object inside
 * their own folder.
 */
const BUCKET = "documents"
const SIGNED_URL_TTL_SECONDS = 300 // 5 minutes. Short-lived on purpose.

/**
 * Normalises whatever is stored in `file_url` into a Storage object path.
 *
 * Accepts a plain object path (the new format) and a legacy public URL
 * (rows created while the bucket was still public) so that existing data
 * keeps working through the API.
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
 *
 * The path must sit inside the caller's own folder — this is the binding
 * between the signed URL and the requesting owner. The user-scoped client
 * is tried first so the storage RLS policies are the real control; the
 * service role is only a fallback for deployments where the policies have
 * not been applied yet (it bypasses RLS, hence the owner check above).
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
    console.warn("[api/documents] storage refused to sign object", error?.message)
  } catch (err) {
    console.warn("[api/documents] signed url failed", err)
  }
  const admin = createServiceClient()
  if (!admin) return null
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  if (error || !data?.signedUrl) {
    console.warn("[api/documents] signed url (service role) failed", error?.message)
    return null
  }
  return data.signedUrl
}

/** Replaces the stored path with a signed URL for the caller's response. */
async function withSignedUrl(supabase: SupabaseClient, userId: string, row: any) {
  const path = toStoragePath(row?.file_url)
  if (!path) return { ...row, storage_path: null, file_url: null }
  const signedUrl = await createOwnerSignedUrl(supabase, userId, path)
  return { ...row, storage_path: path, file_url: signedUrl }
}

export const GET = withAuth(async (req: NextRequest, { supabase, userId }) => {
  const { searchParams } = new URL(req.url)
  const propertyId = searchParams.get("property_id")
  const tenantId = searchParams.get("tenant_id")
  const docType = searchParams.get("type")

  let query = supabase
    .from("documents")
    .select("*, properties(name, address), tenants(full_name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (propertyId) query = query.eq("property_id", propertyId)
  if (tenantId) query = query.eq("tenant_id", tenantId)
  if (docType) query = query.eq("type", docType)

  const { data, error } = await query
  if (error) return errorResponse(error.message, 500)

  const rows = (Array.isArray(data) ? data : []) as any[]
  const signed = await Promise.all(rows.map((row) => withSignedUrl(supabase, userId, row)))
  return successResponse(signed)
})

export const POST = withAuth(async (req: NextRequest, { supabase, userId }) => {
  const body = await req.json().catch(() => null)
  const fields = pickFields<Record<string, any>>(body, DOCUMENT_FIELDS)

  const name = blankToNull(fields.name) || blankToNull(fields.title)
  const type = blankToNull(fields.type) || blankToNull(fields.document_type)
  const rawFileRef = blankToNull(fields.file_url)

  if (!name) throw new HttpError("Document name is required", 400)
  if (!type) throw new HttpError("Document type is required", 400)
  if (!rawFileRef) throw new HttpError("file_url is required (upload to Supabase Storage first)", 400)

  // Store the Storage OBJECT PATH, not a URL: the bucket is private and a
  // URL (public or signed) is either world-readable or expires.
  const storagePath = toStoragePath(rawFileRef)
  if (!storagePath) {
    throw new HttpError("file_url is not a valid storage reference", 400)
  }
  if (!storagePath.startsWith(`${userId}/`)) {
    throw new HttpError("file_url must reference a file in your own storage folder", 400)
  }

  const insert = {
    user_id: userId,
    name,
    type,
    file_url: storagePath,
    file_size: toNumberOrNull(fields.file_size),
    mime_type: blankToNull(fields.mime_type),
    property_id: blankToNull(fields.property_id),
    tenant_id: blankToNull(fields.tenant_id),
    notes: blankToNull(fields.notes),
    expiry_date: blankToNull(fields.expiry_date),
    reminder_days_before: fields.reminder_days_before !== undefined
      ? Math.max(0, Math.min(365, Number(fields.reminder_days_before) || 30))
      : 30,
  }

  const { data, error } = await supabase
    .from("documents")
    .insert([insert])
    .select("*, properties(name, address), tenants(full_name)")
    .single()

  if (error) return errorResponse(error.message, 500)
  return successResponse(await withSignedUrl(supabase, userId, data), 201)
})
