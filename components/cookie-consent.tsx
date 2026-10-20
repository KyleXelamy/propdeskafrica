"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

const STORAGE_KEY = "propdeskafrica_cookie_consent_v2"

/**
 * Pre-rebrand key. Consent is a legal record, so we never drop it on the
 * floor during a rename: read the old key once, copy it across, then remove
 * it. Without this, every existing visitor gets re-prompted for consent they
 * already gave.
 */
const LEGACY_STORAGE_KEY = "imanage_cookie_consent_v1"

type Consent = "all" | "essential" | null

function readConsent(): Consent {
  const current = window.localStorage.getItem(STORAGE_KEY) as Consent
  if (current) return current

  const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY) as Consent
  if (legacy) {
    window.localStorage.setItem(STORAGE_KEY, legacy)
    window.localStorage.removeItem(LEGACY_STORAGE_KEY)
    return legacy
  }
  return null
}

export function CookieConsent() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    try {
      const stored = readConsent()
      if (!stored) {
        // Small delay so it doesn't slam in instantly on first paint.
        const t = setTimeout(() => setOpen(true), 1200)
        return () => clearTimeout(t)
      }
    } catch {
      // localStorage disabled — just don't show the banner.
    }
  }, [])

  function persist(value: Exclude<Consent, null>) {
    try {
      window.localStorage.setItem(STORAGE_KEY, value)
    } catch {
      // ignore
    }
    setOpen(false)
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-xl border border-border/80 bg-card/95 p-4 shadow-[0_18px_55px_-24px_hsl(var(--foreground)/0.45)] backdrop-blur sm:inset-x-auto sm:right-5 sm:bottom-5 sm:p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-tight">Privacy preferences</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            We use essential cookies to keep you signed in and a small set of analytics cookies to
            understand how the site is used. We never use third-party advertising trackers.{" "}
            <Link href="/legal/privacy" className="text-primary underline">
              Read the privacy policy
            </Link>
            .
          </p>
        </div>
        <button
          type="button"
          onClick={() => persist("essential")}
          aria-label="Dismiss"
          className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => persist("essential")}
          className="rounded-full text-muted-foreground"
        >
          Essential only
        </Button>
        <Button
          size="sm"
          onClick={() => persist("all")}
          className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Accept all
        </Button>
      </div>
    </div>
  )
}
