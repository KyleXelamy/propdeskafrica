import { withAuth, errorResponse, successResponse, HttpError } from "@/lib/api"
import { createServiceClient } from "@/lib/supabase/service"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { NextRequest } from "next/server"
import { randomUUID } from "node:crypto"

export const runtime = "nodejs"
const MAX_BYTES = 8 * 1024 * 1024 // 8 MB per image

/**
 * The `documents` bucket is PRIVATE (CRYPTO-005 / CRYPTO-006). Property
 * photos live under the owner's own folder so that the storage policies
 * apply to them exactly like they do to documents:
 *
 *   {userId}/property-photos/{propertyId}/{uuid}.{ext}
 *
 * `property_photos.file_url` stores that OBJECT PATH (not a URL) and the
 * gallery is served with a 5 minute signed URL.
 */
const BUCKET = "documents"
const SIGNED_URL_TTL_SECONDS = 300

/** Allowed image types → canonical extension + accepted file extensions. */
const ALLOWED: Record<string, { ext: string; extensions: string[] }> = {
  "image/png": { ext: "png", extensions: ["png"] },
  "image/jpeg": { ext: "jpg", extensions: ["jpg", "jpeg"] },
  "image/webp": { ext: "webp", extensions: ["webp"] },
  "image/gif": { ext: "gif", extensions: ["gif"] },
}

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function startsWithBytes(buf: Buffer, magic: number[]): boolean {
  if (buf.length < magic.length) return false
  return magic.every((byte, i) => buf[i] === byte)
}

/** Guards the property id, which ends up inside the Storage object key. */
function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

/**
 * Detects the real image type from the magic bytes — `file.type` is the
 * client-declared value and proves nothing.
 */
function sniffImageMime(buf: Buffer): string | null {
  if (startsWithBytes(buf, PNG_MAGIC)) return "image/png"
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg"
  if (buf.length >= 3 && buf.subarray(0, 3).toString("ascii") === "GIF") return "image/gif"
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp"
  }
  return null
}

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
 * True when the object path belongs to `userId`.
 *
 * Current layout:  {userId}/property-photos/{propertyId}/{file}
 * Legacy layout:   property-photos/{userId}/{propertyId}/{file}  (pre-fix
 *                  uploads, which were written with the service role and
 *                  therefore live outside the owner-scoped folder)
 */
function isOwnedPath(userId: string, path: string): boolean {
  if (path.startsWith(`${userId}/`)) return true
  const parts = path.split("/")
  return parts.length >= 2 && parts[0] === "property-photos" && parts[1] === userId
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
  if (!isOwnedPath(userId, path)) return null
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
    if (!error && data?.signedUrl) return data.signedUrl
    console.warn("[api/photos] storage refused to sign object", error?.message)
  } catch (err) {
    console.warn("[api/photos] signed url failed", err)
  }
  const admin = createServiceClient()
  if (!admin) return null
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  if (error || !data?.signedUrl) {
    console.warn("[api/photos] signed url (service role) failed", error?.message)
    return null
  }
  return data.signedUrl
}

/**
 * GET /api/properties/[id]/photos
 * Returns the photo gallery for a property (ordered by display_order, then
 * uploaded_at). Each row includes id, file_url (a short-lived signed URL),
 * caption, is_cover, etc.
 */
export const GET = withAuth<{ id: string }>(async (_req, { supabase, userId }, params) => {
  if (!isUuid(params.id)) throw new HttpError("Invalid property id", 400)
  const { data, error } = await supabase
    .from("property_photos")
    .select("id, file_url, caption, display_order, is_cover, uploaded_at")
    .eq("user_id", userId)
    .eq("property_id", params.id)
    .order("display_order", { ascending: true })
    .order("uploaded_at", { ascending: true })
  if (error) return errorResponse(error.message, 500)

  const rows = (Array.isArray(data) ? data : []) as any[]
  const signed = await Promise.all(
    rows.map(async (row) => {
      const path = toStoragePath(row?.file_url)
      if (!path) return { ...row, storage_path: null, file_url: null }
      return {
        ...row,
        storage_path: path,
        file_url: await createOwnerSignedUrl(supabase, userId, path),
      }
    }),
  )
  return successResponse(signed)
})

/**
 * POST /api/properties/[id]/photos
 * multipart/form-data: `file` (image) + optional `caption` + `isCover` flag.
 */
export const POST = withAuth<{ id: string }>(async (req: NextRequest, { supabase, userId }, params) => {
  // The property id ends up in the Storage object key, so it must be a
  // real UUID — otherwise a crafted id could inject path segments.
  if (!isUuid(params.id)) throw new HttpError("Invalid property id", 400)

  // Verify ownership of the property BEFORE reading or storing anything.
  const { data: prop, error: propErr } = await supabase
    .from("properties")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", userId)
    .maybeSingle()
  if (propErr) return errorResponse(propErr.message, 500)
  if (!prop) throw new HttpError("Property not found", 404)

  const form = await req.formData().catch(() => null)
  if (!form) throw new HttpError("Expected multipart/form-data", 400)
  const file = form.get("file")
  if (!(file instanceof File)) throw new HttpError("Missing file", 400)
  if (file.size > MAX_BYTES) {
    throw new HttpError(`Image too large (max 8 MB, got ${(file.size / 1024 / 1024).toFixed(2)} MB)`, 413)
  }
  if (file.size === 0) throw new HttpError("Image is empty", 400)

  // --- content type + extension (the client-declared type is not proof) ---
  const declaredType = (file.type || "").toLowerCase().split(";")[0].trim()
  const allowed = ALLOWED[declaredType]
  if (!allowed) throw new HttpError("Image must be PNG/JPEG/WEBP/GIF", 415)

  const rawName = file.name.split(/[\\/]/).pop() ?? ""
  const clientExt = (rawName.match(/\.([a-zA-Z0-9]+)$/)?.[1] ?? "").toLowerCase()
  if (!allowed.extensions.includes(clientExt)) {
    throw new HttpError(
      `File extension ".${clientExt || "(none)"}" is not allowed for ${declaredType}. ` +
        `Allowed: ${allowed.extensions.map((e) => "." + e).join(", ")}`,
      415,
    )
  }

  // --- magic bytes --------------------------------------------------------
  const buffer = Buffer.from(await file.arrayBuffer())
  const sniffed = sniffImageMime(buffer)
  if (sniffed !== declaredType) {
    throw new HttpError("Image content does not match its declared type", 415)
  }

  const caption = (form.get("caption") as string | null) || null
  const isCover = form.get("isCover") === "true"

  // The object path starts with the caller's user id, so it satisfies the
  // storage policy `(storage.foldername(name))[1] = auth.uid()::text` and
  // the upload can use the USER-SCOPED client — the service role is not
  // used here any more, so the storage policy is a real control.
  const ext = allowed.ext
  const path = `${userId}/property-photos/${params.id}/${randomUUID()}.${ext}`

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: declaredType, upsert: false, cacheControl: "3600" })
  if (upErr) return errorResponse(upErr.message, 500)

  if (isCover) {
    // clear other covers first
    await supabase
      .from("property_photos")
      .update({ is_cover: false })
      .eq("property_id", params.id)
      .eq("user_id", userId)
  }

  // compute next display_order
  const { data: maxRow } = await supabase
    .from("property_photos")
    .select("display_order")
    .eq("property_id", params.id)
    .eq("user_id", userId)
    .order("display_order", { ascending: false })
    .limit(1)
  const nextOrder = (maxRow?.[0]?.display_order ?? -1) + 1

  const { data, error } = await supabase
    .from("property_photos")
    .insert({
      user_id: userId,
      property_id: params.id,
      file_url: path,
      caption,
      is_cover: isCover,
      display_order: nextOrder,
    })
    .select()
    .single()
  if (error) return errorResponse(error.message, 500)

  return successResponse({
    ...(data as any),
    storage_path: path,
    file_url: await createOwnerSignedUrl(supabase, userId, path),
  })
})

/**
 * DELETE /api/properties/[id]/photos
 * Body: { id: string } — delete one photo row + remove the storage object.
 */
export const DELETE = withAuth<{ id: string }>(async (req: NextRequest, { supabase, userId }, params) => {
  if (!isUuid(params.id)) throw new HttpError("Invalid property id", 400)
  let body: any = {}
  try { body = await req.json() } catch {}
  if (!body.id || typeof body.id !== "string") throw new HttpError("Provide id", 400)

  const { data: row, error: rowErr } = await supabase
    .from("property_photos")
    .select("id, file_url")
    .eq("id", body.id)
    .eq("user_id", userId)
    .eq("property_id", params.id)
    .maybeSingle()
  if (rowErr) return errorResponse(rowErr.message, 500)
  if (!row) throw new HttpError("Photo not found", 404)

  try {
    const path = toStoragePath((row as any)?.file_url)
    if (path) {
      if (isOwnedPath(userId, path)) {
        // The user-scoped client is subject to the storage RLS policies, so
        // this can only remove an object inside the caller's own folder.
        const { error: rmErr } = await supabase.storage.from(BUCKET).remove([path])
        if (rmErr) throw rmErr
      } else {
        // Legacy objects were written with the service role and live
        // outside the owner-scoped folder, so the service role is the only
        // client allowed to remove them.
        const admin = createServiceClient()
        if (admin) await admin.storage.from(BUCKET).remove([path])
      }
    }
  } catch { /* ignore storage errors */ }

  const { error } = await supabase
    .from("property_photos")
    .delete()
    .eq("id", body.id)
    .eq("user_id", userId)
  if (error) return errorResponse(error.message, 500)
  return successResponse({ ok: true })
})

/**
 * PATCH /api/properties/[id]/photos
 * Body: { id: string, is_cover?: boolean, caption?: string }
 * Used to toggle "cover" without re-uploading the file.
 */
export const PATCH = withAuth<{ id: string }>(async (req: NextRequest, { supabase, userId }, params) => {
  let body: any = {}
  try { body = await req.json() } catch {}
  if (!body.id || typeof body.id !== "string") throw new HttpError("Provide id", 400)

  const update: Record<string, any> = {}
  if (typeof body.caption === "string") update.caption = body.caption || null
  if (typeof body.is_cover === "boolean" && body.is_cover) {
    // clear other covers first
    await supabase
      .from("property_photos")
      .update({ is_cover: false })
      .eq("property_id", params.id)
      .eq("user_id", userId)
    update.is_cover = true
  }
  if (Object.keys(update).length === 0) {
    throw new HttpError("Nothing to update", 400)
  }

  const { data, error } = await supabase
    .from("property_photos")
    .update(update)
    .eq("id", body.id)
    .eq("user_id", userId)
    .eq("property_id", params.id)
    .select()
    .single()
  if (error) return errorResponse(error.message, 500)
  return successResponse(data)
})
