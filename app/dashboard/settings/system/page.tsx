import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, ShieldCheck } from "lucide-react"

export const dynamic = "force-dynamic"
export const metadata = {
  title: "System info • PropDesk Africa",
  description: "Workspace protection and account health for your PropDesk Africa workspace.",
}

export default async function SystemPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Workspace health</h1>
        <p className="mt-1 text-muted-foreground">
          PropDesk Africa checks your workspace and keeps it ready automatically.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <ShieldCheck className="size-4 text-primary" />
            <CardTitle className="text-base">Workspace protection</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>Your account, workspace data, and automated safeguards are operating normally.</CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CheckCircle2 className="size-4 text-primary" />
            <CardTitle className="text-base">Everything is up to date</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>PropDesk Africa keeps the workspace current without exposing implementation details.</CardDescription>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
