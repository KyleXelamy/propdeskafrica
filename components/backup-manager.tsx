"use client"

import { useState, useTransition, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Download, Upload, Trash2, RefreshCw, FileJson, CheckCircle2, XCircle, AlertTriangle, Database, Clock, HardDrive, FileArchive, FileText, Save } from "lucide-react"

type Backup = {
  id: string
  label: string
  kind: "full" | "properties" | "tenants" | "payments" | "expenses" | "maintenance" | "documents" | "contacts" | "damages" | "quotations"
  format: "json" | "csv-zip"
  size_bytes: number
  row_count: number
  storage_kind: "inline" | "storage"
  storage_path: string | null
  metadata: Record<string, unknown>
  source: "manual" | "scheduled" | "pre-patch" | "pre-migration"
  created_at: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })
}

const KIND_TABLES: Record<Backup["kind"], string[]> = {
  full: ["All tables"],
  properties: ["properties", "property_photos"],
  tenants: ["tenants"],
  payments: ["rent_payments", "c2b_transactions"],
  expenses: ["expenses", "recurring_expenses"],
  maintenance: ["maintenance_requests"],
  documents: ["documents", "document_expiry_reminders"],
  contacts: ["contacts"],
  damages: ["damages"],
  quotations: ["quotations"],
}

export function BackupManager({ initialBackups, appVersion }: { initialBackups: Backup[]; appVersion: string }) {
  const [backups, setBackups] = useState<Backup[]>(initialBackups)
  const [isCreating, startCreating] = useTransition()
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState<string | null>(null)
  const [importMode, setImportMode] = useState<"skip" | "replace" | "merge">("skip")
  const [autoBackup, setAutoBackup] = useState(false)
  const [autoFrequency, setAutoFrequency] = useState<"daily" | "weekly" | "monthly">("weekly")
  const [autoSaveStatus, setAutoSaveStatus] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function createBackup() {
    startCreating(async () => {
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: `Manual backup ${new Date().toLocaleString("en-KE")}` }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(`Backup failed: ${err.error ?? res.statusText}`)
        return
      }
      const data = await res.json()
      // Save the payload to disk immediately so the user has a copy
      const blob = new Blob([JSON.stringify(data.payload, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = data.filename ?? "propdeskafrica-backup.json"
      a.click()
      URL.revokeObjectURL(url)
      // Refresh list
      const list = await fetch("/api/backup/list").then((r) => r.json())
      setBackups(list.backups ?? [])
    })
  }

  async function downloadBackup(b: Backup) {
    const res = await fetch(`/api/backup/${b.id}`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(`Failed to fetch backup: ${err.error ?? res.statusText}`)
      return
    }
    const data = await res.json()
    if (data.signed_url) {
      // Object-storage path: redirect via signed URL
      const a = document.createElement("a")
      a.href = data.signed_url
      a.download = `${b.label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json`
      a.rel = "noopener"
      a.click()
      return
    }
    const backup = data.backup
    if (!backup?.payload) {
      alert("This backup is temporarily unavailable. Please try again shortly.")
      return
    }
    const blob = new Blob([JSON.stringify(backup.payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${b.label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function deleteBackup(id: string) {
    if (!confirm("Delete this backup? This cannot be undone.")) return
    const res = await fetch(`/api/backup/${id}`, { method: "DELETE" })
    if (res.ok) {
      setBackups(backups.filter((b) => b.id !== id))
    }
  }

  function startImport() {
    fileInputRef.current?.click()
  }

  async function handleFile(file: File) {
    setIsImporting(true)
    setImportError(null)
    setImportSuccess(null)
    try {
      const text = await file.text()
      const payload = JSON.parse(text)
      const res = await fetch("/api/backup/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload, options: { on_conflict: importMode, dry_run: false } }),
      })
      const data = await res.json()
      if (!res.ok) {
        setImportError(data.error ?? "Restore failed")
        return
      }
      const r = data.result
      const restored = r.tables_restored?.length ?? 0
      setImportSuccess(`Restored ${restored} table${restored === 1 ? "" : "s"}. Status: ${r.status}.`)
      // Refresh
      const list = await fetch("/api/backup/list").then((r) => r.json())
      setBackups(list.backups ?? [])
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Could not parse file")
    } finally {
      setIsImporting(false)
    }
  }

  const totalSize = backups.reduce((acc, b) => acc + b.size_bytes, 0)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total backups</CardTitle>
            <FileArchive className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{backups.length}</div>
            <p className="text-xs text-muted-foreground">{formatSize(totalSize)} stored</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Latest</CardTitle>
            <Clock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {backups[0] ? formatDate(backups[0].created_at) : "—"}
            </div>
            <p className="text-xs text-muted-foreground">
              {backups[0] ? `${formatSize(backups[0].size_bytes)} • ${backups[0].row_count} rows` : "Create your first backup below"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">App version</CardTitle>
            <HardDrive className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">v{appVersion}</div>
            <p className="text-xs text-muted-foreground">Private workspace copy</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create a backup</CardTitle>
          <CardDescription>
            Export every row you own into a single JSON file. Keep a copy on your laptop, an external drive, or a private cloud folder.
            Restoring a backup is non-destructive by default — it skips rows that already exist.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Button onClick={createBackup} disabled={isCreating} size="lg">
            {isCreating ? (
              <>
                <RefreshCw className="mr-2 size-4 animate-spin" />
                Building…
              </>
            ) : (
              <>
                <Download className="mr-2 size-4" />
                Create & download backup
              </>
            )}
          </Button>
          <p className="text-sm text-muted-foreground">Includes your workspace records, payment history, documents, and activity history.</p>
          <a href="/backup-replication-fixture.json" download="backup-replication-fixture.json" className="inline-flex items-center justify-center rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10">Download test backup file</a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Restore from a backup</CardTitle>
          <CardDescription>
            Upload a previously downloaded JSON backup. Choose what should happen when a row already exists.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="conflict-mode">If a row already exists…</Label>
              <Select value={importMode} onValueChange={(v) => setImportMode(v as any)}>
                <SelectTrigger id="conflict-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="skip">Skip — keep what's there</SelectItem>
                  <SelectItem value="merge">Merge — update non-conflicting columns</SelectItem>
                  <SelectItem value="replace">Replace — overwrite</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleFile(f)
                  e.target.value = ""
                }}
              />
              <Button onClick={startImport} disabled={isImporting} variant="outline" className="w-full sm:w-auto">
                {isImporting ? (
                  <>
                    <RefreshCw className="mr-2 size-4 animate-spin" />
                    Restoring…
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 size-4" />
                    Upload backup file
                  </>
                )}
              </Button>
            </div>
          </div>
          {importError && (
            <Alert variant="destructive">
              <XCircle className="size-4" />
              <AlertTitle>Restore failed</AlertTitle>
              <AlertDescription>{importError}</AlertDescription>
            </Alert>
          )}
          {importSuccess && (
            <Alert>
              <CheckCircle2 className="size-4" />
              <AlertTitle>Restore complete</AlertTitle>
              <AlertDescription>{importSuccess}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle>Auto-backup</CardTitle>
          <CardDescription>
            Optional — schedule automatic backups for your workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-base">Schedule automatic backups</Label>
              <p className="text-sm text-muted-foreground">
                When enabled, PropDesk Africa creates a fresh full backup on the cadence you choose.
              </p>
            </div>
            <Switch checked={autoBackup} onCheckedChange={setAutoBackup} />
          </div>
          {autoBackup && (
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={autoFrequency} onValueChange={(v) => setAutoFrequency(v as any)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly (recommended)</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    setAutoSaveStatus(null)
                    const res = await fetch("/api/backup/auto", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ frequency: autoFrequency }),
                    })
                    const data = await res.json()
                    if (!res.ok) {
                      setAutoSaveStatus(`Failed: ${data.error ?? res.statusText}`)
                      return
                    }
                    setAutoSaveStatus(`Saved settings. Next run will create backup within ${autoFrequency === "daily" ? "24h" : autoFrequency === "weekly" ? "7d" : "30d"}.`)
                    const list = await fetch("/api/backup/list").then((r) => r.json())
                    setBackups(list.backups ?? [])
                  }}
                >
                  <Save className="mr-1 size-3" />
                  Save schedule
                </Button>
                {autoSaveStatus && <span className="text-xs text-muted-foreground">{autoSaveStatus}</span>}
              </div>
              <p className="text-xs text-muted-foreground"><AlertTriangle className="mr-1 inline size-3" />Automatic copies are created privately on the schedule you select.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent backups</CardTitle>
          <CardDescription>Up to 50 most recent backup records for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          {backups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No backups yet. Create your first one above.</p>
          ) : (
            <div className="space-y-2">
              {backups.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-md bg-muted p-2">
                      <FileJson className="size-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{b.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(b.created_at)} • {KIND_TABLES[b.kind]?.join(", ")} • {formatSize(b.size_bytes)} • {b.row_count} rows
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge variant="secondary">{b.format}</Badge>
                        <Badge variant="outline">{b.source}</Badge>
                        {b.storage_kind === "storage" && <Badge variant="outline">object storage</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => downloadBackup(b)}>
                      <Download className="mr-1 size-3" />
                      Download
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteBackup(b.id)}>
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What gets backed up</CardTitle>
          <CardDescription>The exact list of tables included in a full backup. Click any table for a CSV download.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            {(["properties", "tenants", "rent_payments", "expenses", "maintenance_requests", "documents", "contacts", "damages", "quotations"] as const).map((t) => (
              <a
                key={t}
                href={`/api/backup/csv/${t}`}
                className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs transition hover:border-accent hover:bg-accent/10"
                download
              >
                <FileText className="size-3 text-muted-foreground" />
                <span className="capitalize">{t.replace(/_/g, " ")}</span>
                <FileText className="ml-auto size-3 text-muted-foreground" />
              </a>
            ))}
          </div>
          <Separator className="my-4" />
          <p className="text-xs text-muted-foreground">
            Sensitive fields like passwords, tokens, and API keys are automatically stripped from every backup. The JSON is self-describing — open it in any text editor to inspect.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
