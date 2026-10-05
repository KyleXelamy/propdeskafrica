"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Camera, Trash2, Loader2, AlertCircle } from "lucide-react"

interface Props {
  currentUrl: string | null
  fallbackName: string
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || "")
    .join("") || "?"
}

export function AvatarUpload({ currentUrl, fallbackName }: Props) {
  const [url, setUrl] = useState(currentUrl)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleFile = async (file: File) => {
    setError(null)
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const r = await fetch("/api/profile/avatar", { method: "POST", body: fd })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data.error || "Upload failed")
      setUrl(data.avatar_url)
      router.refresh()
    } catch (e: any) {
      setError(e.message || "Upload failed")
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async () => {
    setError(null)
    setLoading(true)
    try {
      const r = await fetch("/api/profile/avatar", { method: "DELETE" })
      if (!r.ok) {
        const data = await r.json().catch(() => ({}))
        throw new Error(data.error || "Remove failed")
      }
      setUrl(null)
      router.refresh()
    } catch (e: any) {
      setError(e.message || "Remove failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
      <Avatar className="h-20 w-20 text-lg">
        <AvatarImage src={url || undefined} alt={fallbackName} />
        <AvatarFallback>{initials(fallbackName)}</AvatarFallback>
      </Avatar>

      <div className="flex-1 space-y-2">
        <p className="text-sm text-muted-foreground">
          PNG, JPEG, WEBP, or GIF. Square images look best.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
              e.target.value = ""
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Camera className="h-4 w-4 mr-2" />
            )}
            {url ? "Change photo" : "Upload photo"}
          </Button>
          {url && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={loading}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove
            </Button>
          )}
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  )
}
