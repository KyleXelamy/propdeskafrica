"use client"

import { useEffect, useState } from "react"
import { Download, Share } from "lucide-react"
import { Button } from "@/components/ui/button"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isIos, setIsIos] = useState(false)

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    setIsInstalled(standalone)
    setIsIos(/iphone|ipad|ipod/i.test(window.navigator.userAgent) && !standalone)

    const handleInstallAvailable = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
    }
    window.addEventListener("beforeinstallprompt", handleInstallAvailable)
    return () => window.removeEventListener("beforeinstallprompt", handleInstallAvailable)
  }, [])

  if (isInstalled) return null

  if (isIos) {
    return (
      <p className="hidden items-center gap-2 text-xs text-muted-foreground lg:flex">
        <Share className="size-3.5" aria-hidden="true" /> Tap Share, then Add to Home Screen
      </p>
    )
  }

  if (!installEvent) return null

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="rounded-full"
      onClick={async () => {
        await installEvent.prompt()
        await installEvent.userChoice
        setInstallEvent(null)
      }}
    >
      <Download data-icon="inline-start" /> Install dashboard
    </Button>
  )
}
