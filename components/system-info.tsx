"use client"

import { useEffect, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { RefreshCw, CheckCircle2, Package, ShieldCheck, AlertCircle, Loader2, GitBranch } from "lucide-react"

type HealthData = {
  ok: boolean
  app: string
  version: string
  db: "neon" | "supabase" | "unconfigured"
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
  const [patchCheck, setPatchCheck] = useState<PatchCheck | null>(null)
  const [isRunning, startRunning] = useTransition()
  const [runResult, setRunResult] = useState<string | null>(null)
  const [secret, setSecret] = useState("")
  const [showSecret, setShowSecret] = useState(false)

  async function refresh() {
    const [h, pc] = await Promise.all([
      fetch("/api/system/health").then((r) => r.json()),
      fetch("/api/system/patches/check").then((r) => r.json()),
    ])
    setHealth(h)
    setPatchCheck(pc)
  }

  useEffect(() => {
    refresh()
  }, [])

  function runMigrations() {
    startRunning(async () => {
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (secret) headers["x-migration-secret"] = secret
      const res = await fetch("/api/migrations/run", {
        method: "POST",
        headers,
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
            Every patch I-Manage knows about. The runner is idempotent — running it twice never applies a patch twice.
            Tenants and live traffic aren't disturbed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={refresh} variant="outline" size="sm">
              <RefreshCw className="mr-1 size-3" />
              Refresh
            </Button>
            <Button onClick={runMigrations} disabled={isRunning} size="sm">
              {isRunning ? (
                <>
                  <Loader2 className="mr-1 size-3 animate-spin" />
                  Running…
                </>
              ) : (
                <>
                  <GitBranch className="mr-1 size-3" />
                  Run all pending patches
                </>
              )}
            </Button>
            <Button
              onClick={() => setShowSecret(!showSecret)}
              variant="ghost"
              size="sm"
            >
              {showSecret ? "Hide secret" : "Use migration secret"}
            </Button>
          </div>
          {showSecret && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-3">
              <input
                type="password"
                placeholder="MIGRATION_SECRET"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                className="flex-1 rounded-md border bg-background px-3 py-1 text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Optional. Sent in the <code className="rounded bg-muted px-1">x-migration-secret</code> header.
              </p>
            </div>
          )}
          {runResult && (
            <Alert>
              <CheckCircle2 className="size-4" />
              <AlertTitle>Migrations result</AlertTitle>
              <AlertDescription>{runResult}</AlertDescription>
            </Alert>
          )}
          {patchCheck && patchCheck.pending_count > 0 && (
            <Alert>
              <AlertCircle className="size-4" />
              <AlertTitle>{patchCheck.pending_count} pending patch{patchCheck.pending_count === 1 ? "" : "es"}</AlertTitle>
              <AlertDescription>
                Click <strong>Run all pending patches</strong> above to bring this instance up to v{patchCheck.current_schema_version}.
              </AlertDescription>
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
          <div className="space-y-2">
            {patches.map((p) => {
              const pending = patchCheck?.pending.some((x) => x.id === p.id) ?? false
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{p.id}</code>
                    <span>{p.description}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">{p.kind}</Badge>
                    {pending ? (
                      <Badge variant="secondary">pending</Badge>
                    ) : (
                      <Badge className="bg-emerald-500/10 text-emerald-700">applied</Badge>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How patching works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            I-Manage ships with a numbered patch log (<code className="rounded bg-muted px-1">lib/system.ts</code>). On boot, the
            migration runner compares what's in the database against that log and applies anything missing.
          </p>
          <p>
            Patches are pure SQL plus a small in-code seed step. They never delete data, never rename user-facing
            tables, and never block writes during application — your paybill keeps accepting payments while a patch
            runs.
          </p>
          <p>
            To run patches from your terminal or CI: <code className="rounded bg-muted px-1">POST /api/migrations/run</code>.
            For local dev no secret is required; in production set the <code className="rounded bg-muted px-1">MIGRATION_SECRET</code> env var.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}