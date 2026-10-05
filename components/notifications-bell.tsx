"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Bell, Check, Trash2, Loader2, ScanLine, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

type Notification = {
  id: string
  type: string
  title: string
  message: string
  severity: "info" | "warning" | "critical" | "success"
  link: string | null
  is_read: boolean
  created_at: string
}

const severityColors: Record<Notification["severity"], string> = {
  info: "bg-chart-3/20 text-chart-3",
  warning: "bg-chart-2/20 text-chart-2",
  critical: "bg-destructive/20 text-destructive",
  success: "bg-chart-4/20 text-chart-4",
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return "just now"
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const d = Math.floor(hr / 24)
  if (d < 30) return `${d}d`
  return new Date(iso).toLocaleDateString()
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch("/api/notifications?limit=25")
      if (!r.ok) throw new Error("failed")
      const data = await r.json()
      setItems(Array.isArray(data) ? data : [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Lightweight poll every 60s while open; idle otherwise.
  useEffect(() => {
    if (!open) return
    load()
    const i = setInterval(load, 60_000)
    return () => clearInterval(i)
  }, [open, load])

  // Initial count poll on mount (for badge).
  useEffect(() => {
    fetch("/api/notifications?unread=1&limit=1")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        // We don't need to store the full count, but touching the endpoint
        // wakes any cached Supabase client too. The unread badge is computed
        // locally once the dropdown opens.
        return Array.isArray(d) ? d.length : 0
      })
      .catch(() => {})
  }, [])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  const unread = items?.filter((n) => !n.is_read).length || 0

  const markAll = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    })
    setItems((prev) => prev?.map((n) => ({ ...n, is_read: true })) ?? prev)
  }

  const markRead = async (n: Notification) => {
    if (n.is_read) return
    setItems((prev) => prev?.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)) ?? prev)
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: n.id }),
    })
  }

  const clearRead = async () => {
    setItems((prev) => prev?.filter((n) => !n.is_read) ?? prev)
    await fetch("/api/notifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all_read: true }),
    })
  }

  const runScan = async () => {
    setScanning(true)
    try {
      const r = await fetch("/api/notifications/scan", { method: "POST" })
      const data = await r.json().catch(() => ({}))
      if (r.ok) {
        const total = (data.lease_inserted || 0) + (data.document_inserted || 0) + (data.recurring_inserted || 0) + (data.maintenance_inserted || 0)
        await load()
        router.refresh()
        return total
      }
      await load()
      return 0
    } finally {
      setScanning(false)
    }
  }

  const handleSelect = (n: Notification) => {
    markRead(n)
    setOpen(false)
    if (n.link) router.push(n.link)
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        className="relative"
        onClick={() => setOpen((o) => !o)}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-medium rounded-full bg-destructive text-destructive-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>

      {open && (
        <div
          className="fixed md:absolute left-2 right-2 md:left-auto md:right-0 top-[68px] md:top-12 z-50 w-auto md:w-96 max-h-[80vh] overflow-hidden rounded-lg border bg-card shadow-xl flex flex-col"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div>
              <h3 className="font-semibold text-sm">Notifications</h3>
              <p className="text-xs text-muted-foreground">
                {unread > 0 ? `${unread} unread` : "All caught up"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 md:hidden"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && items === null ? (
              <div className="p-3 space-y-2">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : !items || items.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-40" />
                No notifications yet.
                <p className="text-xs mt-1">
                  Run a scan to check for expiring leases.
                </p>
              </div>
            ) : (
              <ul className="divide-y">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => handleSelect(n)}
                      className={`w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors flex items-start gap-3 ${
                        !n.is_read ? "bg-muted/20" : ""
                      }`}
                    >
                      <span
                        className={`mt-0.5 inline-block w-2 h-2 rounded-full shrink-0 ${
                          n.severity === "critical"
                            ? "bg-destructive"
                            : n.severity === "warning"
                              ? "bg-chart-2"
                              : n.severity === "success"
                                ? "bg-chart-4"
                                : "bg-chart-3"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 justify-between">
                          <span className="text-sm font-medium truncate">{n.title}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(n.created_at)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                        <span className={`mt-1 inline-block px-1.5 py-0.5 rounded text-[10px] ${severityColors[n.severity] || severityColors.info}`}>
                          {n.type.replace(/_/g, " ")}
                        </span>
                      </div>
                      {!n.is_read && (
                        <span className="shrink-0 mt-1.5 inline-block w-1.5 h-1.5 rounded-full bg-primary" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t px-3 py-2 flex items-center justify-between gap-1 bg-muted/30">
            <Button
              variant="ghost"
              size="sm"
              onClick={runScan}
              disabled={scanning}
              className="text-xs h-7"
            >
              {scanning ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <ScanLine className="h-3 w-3 mr-1" />
              )}
              Run scan
            </Button>
            <div className="flex items-center gap-1">
              {items && items.some((n) => n.is_read) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearRead}
                  className="text-xs h-7 text-muted-foreground"
                  aria-label="Clear read notifications"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
              {unread > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAll}
                  className="text-xs h-7"
                >
                  <Check className="h-3 w-3 mr-1" />
                  Mark all read
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
