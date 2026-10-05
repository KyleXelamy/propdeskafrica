"use client"

import { useEffect, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { RefreshCw, CheckCircle2, Package, ShieldCheck, AlertCircle, Loader2, GitBranch, Activity } from "lucide-react"

type HealthData = {
  ok: boolean
  app: string
  version: string
  db: "neon" | "supabase" | "unconfigured"
  timestamp: string
}

type PingData = {
  ok: boolean
  db: string
  latency_ms: number
  schema_version: string
  db_error?: string
  timestamp: string
}

type PatchInfo = {
  id: string
  description: string
  kind: string
}

type PatchCheck = {
  current_schema_version: number
  applied_count: number
  pending_count: number
  pending: PatchInfo[]
}

export function SystemInfo({ appVersion, schemaVersion, patches }: { appVersion: string; schemaVersion: number; patches: PatchInfo[] }) {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [ping, setPing] = useState<PingData | null>(null)
  const [patchCheck, setPatchCheck] = useState<PatchCheck | null>(null)
  const [isRunning, startRunning] = useTransition()
  const [runResult, setRunResult] = useState<string | null>(null)
  const [hasAttemptedAutoRun, setHasAttemptedAutoRun] = useState(false)

  async function refresh() {
    const [h, p, pc] = await Promise.all([
      fetch("/api/system/health").then((r) => r.json()).catch(() => null),
      fetch("/api/system/ping").then((r) => r.json()).catch(() => null),
      fetch("/api/system/patches/check").then((r) => r.json()).catch(() => null),
    ])
    setHealth(h)
    setPing(p)
    setPatchCheck(pc)
  }

  useEffect(() => {
    let active = true
    async function boot() {
      await refresh()
      if (!active || hasAttemptedAutoRun) return
      setHasAttemptedAutoRun(true)
      const res = await fetch("/api/migrations/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (res.ok) {
        setRunResult("Your workspace is being kept up to date automatically.")
        await refresh()
      }
    }
    boot()
    return () => { active = false }
  }, [hasAttemptedAutoRun])

  function runMigrations() {
    startRunning(async () => {
      const res = await fetch("/api/migrations/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) {
        setRunResult(`Failed: ${data.error ?? res.statusText}`)
        return
      }
      const ok_count = data.results?.filter((r: any) => r.status === "applied").length ?? 0
      const skipped = data.results?.filter((r: any) => r.status === "skipped").length ?? 0
      const failed = data.results?.filter((r: any) => r.status === "failed").length ?? 0
      setRunResult(`Applied ${ok_count}, skipped ${skipped}, failed ${failed}.`)
      refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">App version</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">v{appVersion}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Schema</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">v{schemaVersion}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Database</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold capitalize">{health?.db ?? "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {health?.ok ? (
                <Badge className="bg-emerald-500/10 text-emerald-700">
                  <CheckCircle2 className="mr-1 size-3" />
                  Healthy
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <AlertCircle className="mr-1 size-3" />
                  Unknown
                </Badge>
              )}
            </div>
            {ping && (
              <p className="mt-1 text-xs text-muted-foreground">
                <Activity className="mr-1 inline size-3" />
                DB {ping.latency_ms}ms
                {ping.db_error ? ` • ${ping.db_error}` : ""}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="size-4" />
            System patches
          </CardTitle>
          <CardDescription>
            I-Manage keeps your workspace ready automatically. You do not need to know anything about databases or migrations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={refresh} variant="outline" size="sm">
              <RefreshCw className="mr-1 size-3" />
              Check status
            </Button>
            {patchCheck && patchCheck.pending_count > 0 && (
              <Button onClick={runMigrations} disabled={isRunning} size="sm">
                {isRunning ? <Loader2 className="mr-1 size-3 animate-spin" /> : <GitBranch className="mr-1 size-3" />}
                Finish setup
              </Button>
            )}
          </div>
          {runResult && (
            <Alert>
              <CheckCircle2 className="size-4" />
              <AlertTitle>Workspace ready</AlertTitle>
              <AlertDescription>{runResult}</AlertDescription>
            </Alert>
          )}
          {patchCheck && patchCheck.pending_count > 0 && (
            <Alert>
              <AlertCircle className="size-4" />
              <AlertTitle>Finishing workspace setup</AlertTitle>
              <AlertDescription>I-Manage is preparing the latest features for you. Your data stays safe while this happens.</AlertDescription>
            </Alert>
          )}
          {patchCheck && patchCheck.pending_count === 0 && (
            <Alert>
              <ShieldCheck className="size-4" />
              <AlertTitle>Up to date</AlertTitle>
              <AlertDescription>
                Every patch is applied. Schema v{patchCheck.current_schema_version} is the running version.
              </AlertDescription>
            </Alert>
          )}
          <p className="text-sm text-muted-foreground">
            Updates run safely in the background. There is nothing to install, migrate, or configure manually.
          </p>

        </CardContent>
      </Card>


    </div>
  )
}
