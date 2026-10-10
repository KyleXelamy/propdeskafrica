import { APP_VERSION, CURRENT_SCHEMA_VERSION, describePatches } from "@/lib/system"
import { SystemInfo } from "@/components/system-info"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, Server, GitMerge } from "lucide-react"

export const dynamic = "force-dynamic"
export const metadata = {
  title: "System info • PropDesk Africa",
  description: "Patch status, schema version, and platform health for your PropDesk Africa instance.",
}

export default async function SystemPage() {
  const patches = describePatches()
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Workspace health</h1>
        <p className="mt-1 text-muted-foreground">
          PropDesk Africa checks your workspace and keeps it ready automatically.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <Server className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">Self-hosted</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              This instance runs against your own database. Backups, patches, and data all live where you put them.
            </CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <GitMerge className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">Schema-aware</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Every patch records the schema version it bumps. Old JSON backups still restore into newer schemas.
            </CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <Activity className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">Zero-downtime</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Patches don't lock writes. Tenants applying a patch mid-month won't lose pending payments.
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      <SystemInfo appVersion={APP_VERSION} schemaVersion={CURRENT_SCHEMA_VERSION} patches={patches} />
    </div>
  )
}
