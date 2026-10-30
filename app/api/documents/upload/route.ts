import { withAuth, successResponse, errorResponse, HttpError } from "@/lib/api"
import type { NextRequest } from "next/server"

export const dynamic = "force-dynamic"

/**
 * POST /api/documents/upload — multipart upload to the PRIVATE `documents`
 * bucket in Supabase Storage.
 *
 * The bucket is private (CRYPTO-005 / INFRA-013): the response carries the
 * Storage OBJECT PATH, not a public URL, and the caller registers that path
 * with POST /api/documents. Reads are served with a short-lived signed URL.
 *
 * Expects a multipart/form-data body with:
 *   - file: the binary file (required)
 *   - propertyId / tenantId: optional scoping
 */

const BUCKET = "documents"
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

/**
 * Accepted content types → canonical extension + the file extensions that
 * are allowed for that type. `text/plain` has no magic bytes; everything
 * else is verified against the file's first bytes (see `sniffMime`).
 */
const ALLOWED_TYPES: Record<string, { ext: string; extensions: string[] }> = {
  "application/pdf": { ext: "pdf", extensions: ["pdf"] },
  "application/msword": { ext: "doc", extensions: ["doc"] },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    ext: "docx",
    extensions: ["docx"],
  },
  "image/jpeg": { ext: "jpg", extensions: ["jpg", "jpeg"] },
  "image/png": { ext: "png", extensions: ["png"] },
  "image/gif": { ext: "gif", extensions: ["gif"] },
  "image/webp": { ext: "webp", extensions: ["webp"] },
  "text/plain": { ext: "txt", extensions: ["txt"] },
}

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04] // "PK\x03\x04" — docx is a zip
const OLE2_MAGIC = [0xd0, 0xcf, 0x11, 0xe0] // legacy .doc (OLE2 compound file)
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function startsWithBytes(buf: Buffer, magic: number[]): boolean {
  if (buf.length < magic.length) return false
  return magic.every((byte, i) => buf[i] === byte)
}

/**
 * Detects the real content type from the file's magic bytes. The client's
 * declared `Content-Type` is attacker-controlled, so the bytes are the
 * authority. Returns null when the bytes are not one of the known formats.
 */
function sniffMime(buf: Buffer): string | null {
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
  // A PDF header may be preceded by whitespace, so scan the first kilobyte.
  if (buf.length >= 5 && buf.subarray(0, 1024).includes(Buffer.from("%PDF-"))) {
    return "application/pdf"
  }
  if (startsWithBytes(buf, OLE2_MAGIC)) return "application/msword"
  if (startsWithBytes(buf, ZIP_MAGIC)) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  }
  return null
}

/**
 * `text/plain` has no magic bytes, so it is the one type where the bytes
 * cannot prove the claim. Some browsers still sniff a text/plain response
 * into HTML, so markup at the head of the file is rejected outright.
 */
function looksLikeMarkup(buf: Buffer): boolean {
  const head = buf.subarray(0, 512).toString("utf8").trimStart().toLowerCase()
  return (
    head.startsWith("<!doctype html") ||
    head.startsWith("<html") ||
    head.startsWith("<script") ||
    head.startsWith("<svg") ||
    head.startsWith("<iframe") ||
    head.startsWith("<object") ||
    head.startsWith("<?xml")
  )
}

/**
 * Strips every directory component and anything that is not safe in an
 * object name, so the stored filename can neither escape the user's folder
 * nor smuggle a path separator into the Storage key.
 */
function sanitiseFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "" // drop any directory component
  let cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_") // no separators, no control chars
  cleaned = cleaned.replace(/\.{2,}/g, ".") // no traversal sequences
  cleaned = cleaned.replace(/^[.]+/, "") // no leading dot (hidden files / "..")
  if (!cleaned) cleaned = "upload"
  if (cleaned.length > 80) cleaned = cleaned.slice(0, 80)
  return cleaned
}

export const POST = withAuth(async (req: NextRequest, { supabase, userId }) => {
  const form = await req.formData().catch(() => null)
  if (!form) throw new HttpError("Expected multipart/form-data", 400)

  const file = form.get("file")
  if (!(file instanceof File)) {
    throw new HttpError("file is required", 400)
  }

  // 10 MB cap
  if (file.size > MAX_BYTES) {
    throw new HttpError("File too large (max 10 MB)", 413)
  }
  if (file.size === 0) {
    throw new HttpError("File is empty", 400)
  }

  // --- content type + extension ------------------------------------------
  const declaredType = (file.type || "").toLowerCase().split(";")[0].trim()
  const allowed = ALLOWED_TYPES[declaredType]
  if (!allowed) {
    throw new HttpError(
      `Unsupported file type. Allowed: ${Object.keys(ALLOWED_TYPES).join(", ")}`,
      415,
    )
  }

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
  const sniffed = sniffMime(buffer)
  if (sniffed) {
    if (sniffed !== declaredType) {
      throw new HttpError(
        `File content does not match its declared type (${declaredType})`,
        415,
      )
    }
  } else if (declaredType !== "text/plain") {
    throw new HttpError("File content could not be verified", 415)
  } else if (looksLikeMarkup(buffer)) {
    throw new HttpError("Text file must not contain HTML or markup", 415)
  }

  // --- stored name --------------------------------------------------------
  const base = sanitiseFileName(rawName.replace(/\.[^.]*$/, ""))
  const path = `${userId}/${Date.now()}-${base}.${allowed.ext}`

  // The user-scoped client is used on purpose: the storage INSERT policy
  // (`auth.uid() = foldername(name)[1]`) then applies to the write, so the
  // object physically cannot land outside the caller's own folder.
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      cacheControl: "3600",
      upsert: false,
      contentType: declaredType,
    })

  if (uploadError) {
    return errorResponse(
      `Storage upload failed: ${uploadError.message}. ` +
        `Make sure the 'documents' bucket exists, is PRIVATE, and that the storage ` +
        `policies from supabase-setup/01-create-tables.sql have been applied.`,
      500,
    )
  }

  // The bucket is private: hand back the object path. Never a permanent
  // public URL — reads go through a short-lived signed URL.
  return successResponse({
    file_url: path,
    file_size: file.size,
    mime_type: declaredType,
    storage_path: path,
  }, 201)
})
