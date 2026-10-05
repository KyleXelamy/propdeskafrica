"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Radio, Pause, Play, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react"

type C2BRow = {
  trans_id: string
  trans_time: string
  trans_amount: number
  business_short_code: string
  bill_ref_number: string
  msisdn: string
  first_name: string
  last_name: string
  match_status: string
  match_method: string | null
  match_confidence: number | null
  matched_tenant_id: string | null
  created_at: string
}

function formatKES(n: number) {
  return `KES ${Number(n).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  } catch {
    return iso
  }
}

function formatPhone(p: string) {
  if (!p) return ""
  return p.startsWith("254") ? `0${p.slice(3, 12)}` : p
}

export function LivePaybillFeed({ initial }: { initial?: C2BRow[] }) {
  const [rows, setRows] = useState<C2BRow[]>(initial ?? [])
  const [status, setStatus] = useState<"connecting" | "open" | "closed">("connecting")
  const [paused, setPaused] = useState(false)
  const [lastEventAt, setLastEventAt] = useState<string | null>(null)
  const sourceRef = useRef<EventSource | null>(null)

  function connect() {
    if (sourceRef.current) {
      sourceRef.current.close()
    }
    const es = new EventSource("/api/paybill/stream")
    sourceRef.current = es
    setStatus("connecting")
    es.addEventListener("hello", () => setStatus("open"))
    es.addEventListener("c2b", (e) => {
      if (paused) return
      try {
        const row = JSON.parse((e as MessageEvent).data) as C2BRow
        setRows((prev) => [row, ...prev].slice(0, 50))
        setLastEventAt(row.trans_time)
      } catch {/* ignore */}
    })
    es.onerror = () => {
      setStatus("closed")
      // Auto-reconnect after 5s unless user paused
      if (!paused) setTimeout(() => connect(), 5000)
    }
  }

  useEffect(() => {
    connect()
    return () => sourceRef.current?.close()
  }, [])

  function togglePause() {
    const next = !paused
    setPaused(next)
    if (next) {
      sourceRef.current?.close()
      setStatus("closed")
    } else {
      connect()
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Radio className={`size-4 ${status === "open" ? "animate-pulse text-emerald-500" : status === "connecting" ? "text-amber-500" : "text-muted-foreground"}`} />
            Live paybill feed
          </CardTitle>
          <CardDescription>
            Server-Sent Events stream of every C2B confirmation.
            {lastEventAt && ` Last event ${formatTime(lastEventAt)}.`}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={status === "open" ? "default" : status === "connecting" ? "secondary" : "outline"} className="capitalize">
            {status === "open" ? <><span className="mr-1 size-2 rounded-full bg-emerald-500 animate-pulse" /> live</> : status}
          </Badge>
          <Button size="sm" variant="ghost" onClick={togglePause}>
            {paused ? <Play className="size-3" /> : <Pause className="size-3" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={connect}>
            <RefreshCw className="size-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No transactions yet. When a C2B payment lands, it appears here in real time.
          </p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div
                key={r.trans_id}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm transition hover:bg-muted/30"
              >
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-xs text-muted-foreground">{formatTime(r.trans_time)}</code>
                    {r.match_status === "matched" ? (
                      <Badge className="bg-emerald-500/10 text-emerald-700">
                        <CheckCircle2 className="mr-1 size-3" />
                        matched
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-700">
                        <AlertTriangle className="mr-1 size-3" />
                        unmatched
                      </Badge>
                    )}
                  </div>
                  <p className="font-medium">
                    {(r.first_name ?? "") + " " + (r.last_name ?? "")} • {formatPhone(r.msisdn)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Bill ref {r.bill_ref_number || "—"} • {r.match_method ?? "no rule"} • confidence {r.match_confidence ?? 0}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatKES(r.trans_amount)}</p>
                  <p className="font-mono text-xs text-muted-foreground">{r.trans_id.slice(-8)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}