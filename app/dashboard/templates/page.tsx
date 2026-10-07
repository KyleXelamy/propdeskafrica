"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  FileText, Download, Loader2, AlertCircle, CheckCircle2, Sparkles,
} from "lucide-react"

interface Template {
  id: string
  title: string
  description: string
  category: string
  pages: number
  fields: string[]
}

const FIELD_LABELS: Record<string, string> = {
  landlordName: "Landlord / Agency name",
  landlordAddress: "Landlord address",
  landlordId: "Landlord ID / Company reg",
  tenantName: "Tenant full name",
  tenantId: "Tenant ID number",
  tenantPhone: "Tenant phone",
  propertyName: "Property name",
  propertyAddress: "Property address",
  leaseStart: "Lease start date",
  leaseEnd: "Lease end date",
  rentAmount: "Monthly rent (KES)",
  deposit: "Refundable deposit (KES)",
  periodCovered: "Period covered",
  amountPaid: "Amount paid (KES)",
  paymentMethod: "Payment method",
  reference: "M-Pesa reference",
  handoverDate: "Handover date",
  inspectionDate: "Inspection date",
  inspectionType: "Inspection type",
  category: "Category",
  priority: "Priority",
  description: "Description",
  preferredTime: "Preferred access time",
  requestDate: "Request date",
  terminationDate: "Termination effective date",
  reason: "Reason (optional)",
  currentRent: "Current rent (KES)",
  newRent: "New rent (KES)",
  effectiveDate: "Effective date",
  incidentDate: "Incident date",
}

const FIELD_TYPES: Record<string, "text" | "date" | "number" | "textarea" | "select"> = {
  leaseStart: "date",
  leaseEnd: "date",
  handoverDate: "date",
  inspectionDate: "date",
  inspectionType: "select",
  rentAmount: "number",
  deposit: "number",
  amountPaid: "number",
  currentRent: "number",
  newRent: "number",
  priority: "select",
  category: "select",
  description: "textarea",
  reason: "textarea",
  paymentMethod: "select",
  preferredTime: "text",
  requestDate: "date",
  terminationDate: "date",
  effectiveDate: "date",
  incidentDate: "date",
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [preview, setPreview] = useState<any | null>(null)

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((d) => setTemplates(Array.isArray(d) ? d : []))
      .catch(() => setTemplates([]))
  }, [])

  const selected = useMemo(() => templates?.find((t) => t.id === selectedId) || null, [templates, selectedId])

  const handleDownload = async () => {
    if (!selected) return
    setError(null)
    setSuccess(null)
    setDownloading(true)
    try {
      const r = await fetch(`/api/templates/${selected.id}/docx`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fields }),
      })
      if (!r.ok) {
        const data = await r.json().catch(() => ({}))
        throw new Error((data as any).error || "Download failed")
      }
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${selected.id}-${new Date().toISOString().slice(0, 10)}.docx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setSuccess(`Downloaded ${selected.title}.`)
    } catch (e: any) {
      setError(e.message || "Download failed")
    } finally {
      setDownloading(false)
    }
  }

  const handlePreview = async () => {
    if (!selected) return
    setPreview(null)
    const r = await fetch(`/api/templates/${selected.id}/preview`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fields }),
    })
    const d = await r.json().catch(() => null)
    setPreview(d)
  }

  return (
    <div className="space-y-6 pt-2 md:pt-0">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
          <FileText className="h-6 w-6" /> Templates
        </h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Kenya-specific lease, receipt, inspection, and notice templates. Fill in the fields and download a real .docx.
        </p>
      </div>

      {!templates ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>No templates loaded.</AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => { setSelectedId(t.id); setFields({}); setPreview(null); setSuccess(null); setError(null) }}
              className={`text-left rounded-lg border p-4 transition-colors ${
                selectedId === t.id
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "hover:border-primary/40 hover:bg-muted/30"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-sm">{t.title}</h3>
                <Badge variant="secondary" className="text-[10px]">{t.category}</Badge>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-3">{t.description}</p>
              <p className="text-[10px] text-muted-foreground mt-2">
                {t.pages} page{t.pages === 1 ? "" : "s"} · {t.fields.length} field{t.fields.length === 1 ? "" : "s"}
              </p>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              {selected.title}
            </CardTitle>
            <CardDescription className="text-sm">{selected.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>
            )}
            {success && (
              <Alert className="border-chart-4/30 bg-chart-4/5">
                <CheckCircle2 className="h-4 w-4 text-chart-4" /><AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              {selected.fields.map((f) => {
                const label = FIELD_LABELS[f] || f
                const type = FIELD_TYPES[f] || "text"
                const value = fields[f] || ""
                const setValue = (v: string) => setFields((prev) => ({ ...prev, [f]: v }))
                return (
                  <div key={f} className="space-y-1.5">
                    <Label htmlFor={f}>{label}</Label>
                    {type === "textarea" ? (
                      <Textarea id={f} rows={3} value={value} onChange={(e) => setValue(e.target.value)} />
                    ) : type === "select" ? (
                      <Select value={value} onValueChange={setValue}>
                        <SelectTrigger id={f}><SelectValue placeholder="Select…" /></SelectTrigger>
                        <SelectContent>
                          {f === "priority" && (
                            <>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="urgent">Urgent</SelectItem>
                            </>
                          )}
                          {f === "category" && (
                            <>
                              <SelectItem value="general">General</SelectItem>
                              <SelectItem value="plumbing">Plumbing</SelectItem>
                              <SelectItem value="electrical">Electrical</SelectItem>
                              <SelectItem value="appliance">Appliance</SelectItem>
                              <SelectItem value="structural">Structural</SelectItem>
                              <SelectItem value="pest">Pest control</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </>
                          )}
                          {f === "inspectionType" && (
                            <>
                              <SelectItem value="Move-in">Move-in</SelectItem>
                              <SelectItem value="Move-out">Move-out</SelectItem>
                            </>
                          )}
                          {f === "paymentMethod" && (
                            <>
                              <SelectItem value="M-Pesa">M-Pesa</SelectItem>
                              <SelectItem value="Bank transfer">Bank transfer</SelectItem>
                              <SelectItem value="Cash">Cash</SelectItem>
                              <SelectItem value="Cheque">Cheque</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input id={f} type={type} value={value} onChange={(e) => setValue(e.target.value)} />
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleDownload} disabled={downloading}>
                {downloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                Download .docx
              </Button>
              <Button variant="outline" onClick={handlePreview}>
                Preview
              </Button>
              <Button variant="ghost" onClick={() => { setFields({}); setPreview(null) }}>
                Clear
              </Button>
            </div>

            {preview && (
              <Card className="border-dashed bg-muted/30">
                <CardContent className="pt-4 text-sm space-y-3">
                  {preview.sections?.map((s: any, i: number) => (
                    <div key={i}>
                      <h4 className="font-semibold mb-1">{s.heading}</h4>
                      <ul className="space-y-0.5 text-muted-foreground">
                        {s.lines.map((l: string, j: number) => (
                          <li key={j}>· {l}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground italic">
                    This is a quick preview. The downloaded .docx has full page layout, headers, signature blocks, and page numbers.
                  </p>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}