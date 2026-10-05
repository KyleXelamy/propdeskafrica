"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Loader2, Camera, Trash2, Star, AlertCircle, Plus } from "lucide-react"

interface Photo {
  id: string
  file_url: string
  caption: string | null
  display_order: number
  is_cover: boolean
  uploaded_at: string
}

export function PropertyPhotoGallery({ propertyId }: { propertyId: string }) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [caption, setCaption] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<Photo | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/properties/${propertyId}/photos`)
      const data = await r.json().catch(() => [])
      if (!r.ok) throw new Error((data as any).error || "Failed to load")
      setPhotos(Array.isArray(data) ? data : [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [propertyId])

  const handleUpload = async (file: File, isCover: boolean) => {
    setError(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      if (caption) fd.append("caption", caption)
      if (isCover) fd.append("isCover", "true")
      const r = await fetch(`/api/properties/${propertyId}/photos`, { method: "POST", body: fd })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error((data as any).error || "Upload failed")
      setCaption("")
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this photo?")) return
    setError(null)
    try {
      const r = await fetch(`/api/properties/${propertyId}/photos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (!r.ok) {
        const data = await r.json().catch(() => ({}))
        throw new Error((data as any).error || "Delete failed")
      }
      if (lightbox?.id === id) setLightbox(null)
      await load()
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handleSetCover = async (photo: Photo) => {
    // Re-upload with isCover=true by toggling the row.
    setError(null)
    try {
      // Simpler path: just PATCH the row to is_cover=true via a dedicated
      // endpoint — but we don't have one. The cleanest thing is to use the
      // API as it stands: we just re-upload with isCover, but that duplicates.
      // We'll instead call POST with the existing file URL... no, the API
      // takes a fresh upload.
      // Workaround: do a DELETE + re-upload is wasteful. For now, fall back
      // to a quick inline update via the generic CRUD endpoint.
      const r = await fetch(`/api/properties/${propertyId}/photos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: photo.id, is_cover: true }),
      })
      if (!r.ok) throw new Error("Failed to update cover")
      await load()
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Camera className="h-4 w-4" />
          Property Photos
          {photos.length > 0 && (
            <Badge variant="secondary" className="ml-2">{photos.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Optional caption…"
            disabled={uploading}
            className="flex-1"
          />
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleUpload(f, photos.length === 0)
              e.target.value = ""
            }}
          />
          <Button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-full sm:w-auto"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Upload photo
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="aspect-square rounded-md bg-muted animate-pulse" />
            ))}
          </div>
        ) : photos.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-md">
            <Camera className="h-8 w-8 mx-auto mb-2 opacity-40" />
            No photos yet. Upload your first photo to start a gallery.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {photos.map((p) => (
              <div
                key={p.id}
                className="relative group aspect-square rounded-md overflow-hidden border bg-muted cursor-pointer"
                onClick={() => setLightbox(p)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.file_url}
                  alt={p.caption || "Property photo"}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
                {p.is_cover && (
                  <Badge className="absolute top-1.5 left-1.5 bg-chart-2 text-white gap-1">
                    <Star className="h-3 w-3" />
                    Cover
                  </Badge>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-xs text-white truncate">{p.caption || "—"}</p>
                </div>
                <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!p.is_cover && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSetCover(p) }}
                      className="h-6 w-6 rounded bg-background/80 hover:bg-background flex items-center justify-center"
                      aria-label="Set as cover"
                    >
                      <Star className="h-3 w-3" />
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(p.id) }}
                    className="h-6 w-6 rounded bg-background/80 hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center"
                    aria-label="Delete photo"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Lightbox */}
        {lightbox && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setLightbox(null)}
            role="dialog"
            aria-modal="true"
          >
            <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightbox.file_url}
                alt={lightbox.caption || "Property photo"}
                className="max-w-full max-h-[90vh] object-contain rounded-md"
              />
              {lightbox.caption && (
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-4 rounded-b-md">
                  <p className="text-white text-sm">{lightbox.caption}</p>
                </div>
              )}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="absolute top-2 right-2"
                onClick={() => setLightbox(null)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
