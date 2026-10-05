import { withAuth, successResponse, errorResponse, HttpError } from "@/lib/api"
import type { NextRequest } from "next/server"

export const dynamic = "force-dynamic"

/**
 * POST /api/documents/upload — multipart upload to the `documents` bucket
 * in Supabase Storage. Returns a public URL the client then passes to
 * POST /api/documents to register the row.
 *
 * Expects a multipart/form-data body with:
 *   - file: the binary file (required)
 *   - propertyId / tenantId: optional scoping
 */
export const POST = withAuth(async (req: NextRequest, { supabase, userId }) => {
  const form = await req.formData().catch(() => null)
  if (!form) throw new HttpError("Expected multipart/form-data", 400)

  const file = form.get("file")
  if (!(file instanceof File)) {
    throw new HttpError("file is required", 400)
  }

  // 10 MB cap
  if (file.size > 10 * 1024 * 1024) {
    throw new HttpError("File too large (max 10 MB)", 413)
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
  const path = `${userId}/${Date.now()}-${safeName}`

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/octet-stream",
    })

  if (uploadError) {
    return errorResponse(
      `Storage upload failed: ${uploadError.message}. ` +
        `Make sure the 'documents' bucket exists in Supabase Storage and is public.`,
      500,
    )
  }

  const { data: pub } = supabase.storage.from("documents").getPublicUrl(path)

  return successResponse({
    file_url: pub.publicUrl,
    file_size: file.size,
    mime_type: file.type || null,
    storage_path: path,
  }, 201)
})
