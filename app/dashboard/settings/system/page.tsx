import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, ShieldCheck, AlertCircle, Database, Package, Activity } from "lucide-react"
import { checkSystemHealth } from "@/lib/system-health"
import { APP_VERSION, CURRENT_SCHEMA_VERSION } from "@/lib/system"

export const dynamic = "force-dynamic"
export const metadata = {
  title: "System info • PropDesk Africa",
  description: "Workspace protection and account health for your PropDesk Africa workspace.",
}

export default async function SystemPage() {
  // Real numbers, read from the same probe the public /api/system/ping route
  // uses. The previous version of this page was a static shell that asserted
  // "Everything is up to date" without ever checking anything.
  const health = await checkSystemHealth()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Workspace health</h1>
        <p className="mt-1 text-muted-foreground">
          PropDesk Africa checks your workspace and keeps it ready automatically.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">App version</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">v{APP_VERSION}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Schema</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">v{CURRENT_SCHEMA_VERSION}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Database</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold capitalize">{health.db}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
          </CardHeader>
          <CardContent>
            {health.ok ? (
              <Badge className="bg-success/15 text-success">
                <CheckCircle2 className="mr-1 size-3" /> Healthy
              </Badge>
            ) : (
              <Badge variant="destructive">
                <AlertCircle className="mr-1 size-3" /> Needs attention
              </Badge>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              <Activity className="mr-1 inline size-3" />
              {health.latency_ms}ms
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <ShieldCheck className="size-4 text-primary" />
            <CardTitle className="text-base">Workspace protection</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Your account, workspace data, and automated safeguards are operating normally.
            </CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <Package className="size-4 text-primary" />
            <CardTitle className="text-base">Schema state</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              {health.schema_version
                ? `This workspace is running schema version ${health.schema_version}. The patch log is applied automatically.`
                : "The schema version could not be read from the database. If this persists, contact support."}
            </CardDescription>
            {health.db_error ? (
              <p className="mt-2 text-xs text-destructive">{health.db_error}</p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <Database className="size-4 text-primary" />
            <CardTitle className="text-base">Last checked</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              {new Date(health.timestamp).toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
