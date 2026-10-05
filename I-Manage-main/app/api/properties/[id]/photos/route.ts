import { withAuth, errorResponse, successResponse, HttpError } from "@/lib/api"
import type { NextRequest } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { randomUUID } from "node:crypto"

export const runtime = "nodejs"
const MAX_BYTES = 8 * 1024 * 1024 // 8 MB per image
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"])

/**
 * GET /api/properties/[id]/photos
 * Returns the photo gallery for a property (ordered by display_order, then
 * uploaded_at). Each row includes id, file_url, caption, is_cover, etc.
 */
export const GET = withAuth(async (_req, _ctx, { supabase, userId, params }) => {
  const { data, error } = await supabase
    .from("property_photos")
    .select("id, file_url, caption, display_order, is_cover, uploaded_at")
    .eq("user_id", userId)
    .eq("property_id", params.id)
    .order("display_order", { ascending: true })
    .order("uploaded_at", { ascending: true })
  if (error) return errorResponse(error.message, 500)
  return successResponse(data || [])
})

/**
 * POST /api/properties/[id]/photos
 * multipart/form-data: `file` (image) + optional `caption` + `isCover` flag.
 */
export const POST = withAuth(async (req: NextRequest, _ctx, { supabase, userId, params }) => {
  const form = await req.formData().catch(() => null)
  if (!form) throw new HttpError("Expected multipart/form-data", 400)
  const file = form.get("file")
  if (!(file instanceof File)) throw new HttpError("Missing file", 400)
  if (!ALLOWED.has(file.type)) throw new HttpError("Image must be PNG/JPEG/WEBP/GIF", 415)
  if (file.size > MAX_BYTES) {
    throw new HttpError(`Image too large (max 8 MB, got ${(file.size / 1024 / 1024).toFixed(2)} MB)`, 413)
  }
  const caption = (form.get("caption") as string | null) || null
  const isCover = form.get("isCover") === "true"

  // Verify ownership of the property first
  const { data: prop, error: propErr } = await supabase
    .from("properties")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", userId)
    .maybeSingle()
  if (propErr) return errorResponse(propErr.message, 500)
  if (!prop) throw new HttpError("Property not found", 404)

  const ext = file.type === "image/png" ? "png"
            : file.type === "image/webp" ? "webp"
            : file.type === "image/gif" ? "gif"
            : "jpg"
  const path = `property-photos/${userId}/${params.id}/${randomUUID()}.${ext}`

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const storageClient = serviceKey && url
    ? createServiceClient(url, serviceKey, { auth: { persistSession: false } })
    : supabase

  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: upErr } = await storageClient.storage
    .from("documents")
    .upload(path, buffer, { contentType: file.type, upsert: true, cacheControl: "3600" })
  if (upErr) return errorResponse(upErr.message, 500)
  const { data: pub } = storageClient.storage.from("documents").getPublicUrl(path)

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
      file_url: pub.publicUrl,
      caption,
      is_cover: isCover,
      display_order: nextOrder,
    })
    .select()
    .single()
  if (error) return errorResponse(error.message, 500)
  return successResponse(data)
})

/**
 * DELETE /api/properties/[id]/photos
 * Body: { id: string } — delete one photo row + remove the storage object.
 */
export const DELETE = withAuth(async (req: NextRequest, _ctx, { supabase, userId, params }) => {
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
    const marker = "/storage/v1/object/public/documents/"
    const i = row.file_url.indexOf(marker)
    if (i > -1) {
      const path = row.file_url.slice(i + marker.length)
      await supabase.storage.from("documents").remove([path])
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
export const PATCH = withAuth(async (req: NextRequest, _ctx, { supabase, userId, params }) => {
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
