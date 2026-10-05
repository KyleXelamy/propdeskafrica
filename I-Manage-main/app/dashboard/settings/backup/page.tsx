import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { listBackups } from "@/lib/backup"
import { APP_VERSION } from "@/lib/system"
import { BackupManager } from "@/components/backup-manager"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Database, FileText, History } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export const dynamic = "force-dynamic"
export const metadata = {
  title: "Backup & restore • I-Manage",
  description: "Back up your entire workspace or restore from a previous backup. No data leaves your database.",
}

export default async function BackupPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const backups = await listBackups(user.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Backup & restore</h1>
        <p className="mt-1 text-muted-foreground">
          Take your data with you. Your backup is a plain JSON file you can store anywhere.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <Database className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">Self-contained</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Backups include the data, the schema version, and the app version. Restore into any
              I-Manage instance — fresh, live, or recovered.
            </CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <FileText className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">Plain JSON</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Open the file in any editor. Inspect, audit, or hand it to your accountant. No
              proprietary format, no lock-in.
            </CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <History className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">Full history</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Up to 50 recent backups are kept in your database. Older ones download but aren't indexed.
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      <BackupManager initialBackups={backups} appVersion={APP_VERSION} />

      <div className="flex justify-end">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/settings/system">System info & patches →</Link>
        </Button>
      </div>
    </div>
  )
}