"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Loader2, UserPlus, Link2, AlertCircle, CheckCircle2, X } from "lucide-react"
import { apiFetch, ApiError } from "@/lib/api/client"

export function TenantInviteCard({
  tenantId,
  tenantEmail,
  initiallyLinked,
}: {
  tenantId: string
  tenantEmail: string | null
  initiallyLinked: boolean
}) {
  const [linked, setLinked] = useState(initiallyLinked)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  if (!tenantEmail) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Tenant Portal Access
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Add an email address to the tenant first — it&apos;s required to
            send a portal invite.
          </p>
        </CardContent>
      </Card>
    )
  }

  const handleInvite = async () => {
    setMsg(null)
    setLoading(true)
    try {
      await apiFetch(`/api/tenants/${tenantId}/invite`, {
        method: "POST",
        body: { email: tenantEmail },
      })
      setLinked(true)
      setMsg({ type: "success", text: "Tenant linked. They can sign in at /portal." })
    } catch (e: any) {
      const text = e instanceof ApiError ? e.message : e?.message || "Invite failed"
      setMsg({ type: "error", text })
    } finally {
      setLoading(false)
    }
  }

  const handleUnlink = async () => {
    if (!confirm(`Remove portal access for ${tenantEmail}?`)) return
    setMsg(null)
    setLoading(true)
    try {
      await apiFetch(`/api/tenants/${tenantId}/invite`, { method: "DELETE" })
      setLinked(false)
      setMsg({ type: "success", text: "Portal access removed." })
    } catch (e: any) {
      const text = e instanceof ApiError ? e.message : e?.message || "Unlink failed"
      setMsg({ type: "error", text })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          Tenant Portal Access
        </CardTitle>
        <CardDescription className="text-sm">
          Tenants with portal access can sign in at <code className="text-xs">/portal</code> to
          view their lease, payments, documents, and submit maintenance requests.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground min-w-0">
            <Link2 className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{tenantEmail}</span>
          </div>
          {linked ? (
            <Badge variant="default" className="bg-chart-4 text-white">Linked</Badge>
          ) : (
            <Badge variant="outline">Not linked</Badge>
          )}
        </div>

        {msg && (
          <Alert variant={msg.type === "error" ? "destructive" : "default"} className={msg.type === "success" ? "border-chart-4/30 bg-chart-4/5" : ""}>
            {msg.type === "error" ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4 text-chart-4" />}
            <AlertDescription>{msg.text}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap gap-2">
          {linked ? (
            <Button variant="outline" size="sm" onClick={handleUnlink} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <X className="h-4 w-4 mr-2" />}
              Remove access
            </Button>
          ) : (
            <Button onClick={handleInvite} disabled={loading} size="sm">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
              Invite tenant
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          The tenant must already have a I-Manage account (signed up at
          <code className="mx-1 text-xs">/auth/sign-up</code>) using this email
          for the link to succeed.
        </p>
      </CardContent>
    </Card>
  )
}
