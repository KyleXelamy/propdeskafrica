"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Loader2, Trash2 } from "lucide-react"

interface DeleteButtonProps {
  /** API endpoint to POST/DELETE to, e.g. "/api/properties/abc-123" */
  endpoint: string
  /** Resource name shown in the confirmation dialog */
  resource: string
  /** Where to navigate after a successful delete (defaults to the list page) */
  redirectTo?: string
  /** Called after a successful delete (for refresh / state update) */
  onSuccess?: () => void
  /** Small button variant for inline use */
  size?: "default" | "sm" | "icon"
  variant?: "destructive" | "outline" | "ghost"
  className?: string
  label?: string
}

/**
 * Generic delete button with a confirmation dialog. Hits the API
 * endpoint with DELETE, then refreshes the page or calls onSuccess.
 */
export function DeleteButton({
  endpoint,
  resource,
  redirectTo,
  onSuccess,
  size = "sm",
  variant = "outline",
  className,
  label = "Delete",
}: DeleteButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(endpoint, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Delete failed")
      }
      setOpen(false)
      onSuccess?.()
      if (redirectTo) {
        router.push(redirectTo)
      } else {
        router.refresh()
      }
    } catch (e: any) {
      setError(e.message || "Delete failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={className}
          aria-label={`Delete ${resource}`}
        >
          <Trash2 className="h-4 w-4" />
          {size !== "icon" && <span className="ml-1">{label}</span>}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {resource}?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. The {resource} will be permanently removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <div className="bg-destructive/10 border border-destructive/50 text-destructive px-4 py-2 rounded-md text-sm">
            {error}
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={(e) => { e.preventDefault(); handleDelete() }} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
