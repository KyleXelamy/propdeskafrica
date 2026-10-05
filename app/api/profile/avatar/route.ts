import { withAuth, errorResponse, successResponse, HttpError } from "@/lib/api"
import type { NextRequest } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { randomUUID } from "node:crypto"

export const runtime = "nodejs"
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"])

/**
 * POST /api/profile/avatar
 * multipart/form-data with `file` field. Uploads to the `documents` bucket
 * under a per-user folder, then persists the public URL on the user's
 * `user_profiles.avatar_url` column. Replaces the previous avatar.
 */
export const POST = withAuth(async (req: NextRequest, { supabase, userId }) => {
  const form = await req.formData().catch(() => null)
  if (!form) throw new HttpError("Expected multipart/form-data", 400)
  const file = form.get("file")
  if (!(file instanceof File)) throw new HttpError("Missing file", 400)
  if (!ALLOWED.has(file.type)) throw new HttpError("Avatar must be PNG/JPEG/WEBP/GIF", 415)
  if (file.size > MAX_BYTES) {
    throw new HttpError(`Image too large (max 5 MB, got ${(file.size / 1024 / 1024).toFixed(2)} MB)`, 413)
  }

  const ext = file.type === "image/png" ? "png"
            : file.type === "image/webp" ? "webp"
            : file.type === "image/gif" ? "gif"
            : "jpg"
  const path = `avatars/${userId}/${randomUUID()}.${ext}`

  // For the storage upload we need to bypass RLS-scoped client (which is
  // bound to the user's session cookie). Use a service-role client if
  // available; otherwise fall back to the authed client (which works for
  // objects under a user's own folder if Storage policies allow).
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
  const publicUrl = pub.publicUrl

  const { error: dbErr } = await supabase
    .from("user_profiles")
    .upsert({ user_id: userId, avatar_url: publicUrl, updated_at: new Date().toISOString() })
  if (dbErr) return errorResponse(dbErr.message, 500)

  return successResponse({ avatar_url: publicUrl })
})

export const DELETE = withAuth(async (_req, { supabase, userId }) => {
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("avatar_url")
    .eq("user_id", userId)
    .maybeSingle()
  if (profile?.avatar_url) {
    // Best-effort: extract path and try to remove
    try {
      const marker = "/storage/v1/object/public/documents/"
      const i = profile.avatar_url.indexOf(marker)
      if (i > -1) {
        const path = profile.avatar_url.slice(i + marker.length)
        await supabase.storage.from("documents").remove([path])
      }
    } catch { /* ignore */ }
  }
  const { error } = await supabase
    .from("user_profiles")
    .upsert({ user_id: userId, avatar_url: null, updated_at: new Date().toISOString() })
  if (error) return errorResponse(error.message, 500)
  return successResponse({ ok: true })
})
