import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { listBackups } from "@/lib/backup"
import { APP_VERSION } from "@/lib/system"
import { BackupManager } from "@/components/backup-manager"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Database, FileText, History } from "lucide-react"

export const dynamic = "force-dynamic"
export const metadata = {
  title: "Backup & restore • PropDesk Africa",
  description: "Create a private copy of your workspace or restore from a previous backup.",
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
              Keep a private copy of your workspace data and restore it when needed.
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
              Download a portable copy for your records or secure off-site storage.
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
              Recent backups stay available in your workspace so you can recover confidently without leaving the product.
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      <BackupManager initialBackups={backups} appVersion={APP_VERSION} />

    </div>
  )
}
