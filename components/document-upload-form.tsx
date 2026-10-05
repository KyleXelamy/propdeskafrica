"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Upload, File, AlertCircle, CheckCircle2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { apiFetch, ApiError } from "@/lib/api/client"
import { tenantName } from "@/lib/utils"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ACCEPTED_TYPES = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.txt"

export function DocumentUploadForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [properties, setProperties] = useState<any[]>([])
  const [tenants, setTenants] = useState<any[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = useState<{ file_url: string; file_size: number; mime_type: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    type: "other",
    property_id: "",
    tenant_id: "",
    notes: "",
    expiry_date: "",
    reminder_days_before: 30,
  })

  // Fetch properties and tenants for dropdowns
  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()
      const [propertiesResult, tenantsResult] = await Promise.all([
        supabase.from("properties").select("id, name, address").order("name"),
        supabase
          .from("tenants")
          .select("id, full_name, first_name, last_name, property_id")
          .eq("status", "active")
          .order("full_name"),
      ])

      if (propertiesResult.error) {
        console.error("[i-manage] fetch properties error", propertiesResult.error)
      } else {
        setProperties(propertiesResult.data || [])
      }

      if (tenantsResult.error) {
        console.error("[i-manage] fetch tenants error", tenantsResult.error)
      } else {
        setTenants(tenantsResult.data || [])
      }
    }

    fetchData()
  }, [])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    setError(null)
    setUploadedFile(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }

    if (!file) {
      setSelectedFile(null)
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setError(`File is too large (max 10 MB). Your file is ${(file.size / 1024 / 1024).toFixed(2)} MB.`)
      e.target.value = ""
      return
    }

    setSelectedFile(file)
    if (file.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(file))
    }
    if (!formData.name) {
      const fileName = file.name.replace(/\.[^/.]+$/, "")
      setFormData((prev) => ({ ...prev, name: fileName }))
    }
  }

  const handleUploadFile = async () => {
    if (!selectedFile) return
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append("file", selectedFile)
      const res = await fetch("/api/documents/upload", { method: "POST", body: fd, credentials: "same-origin" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || `Upload failed (${res.status})`)
      }
      setUploadedFile({
        file_url: data.file_url,
        file_size: data.file_size,
        mime_type: data.mime_type,
      })
    } catch (e: any) {
      setError(e.message || "Upload failed")
      setSelectedFile(null)
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadedFile) {
      setError("Please upload a file first")
      return
    }
    if (!formData.name) {
      setError("Document name is required")
      return
    }
    if (!formData.type) {
      setError("Document type is required")
      return
    }

    setLoading(true)
    setError(null)

    try {
      await apiFetch("/api/documents", {
        method: "POST",
        body: {
          name: formData.name,
          type: formData.type,
          file_url: uploadedFile.file_url,
          file_size: uploadedFile.file_size,
          mime_type: uploadedFile.mime_type,
          property_id: formData.property_id || null,
          tenant_id: formData.tenant_id || null,
          notes: formData.notes || null,
          expiry_date: formData.expiry_date || null,
          reminder_days_before: formData.reminder_days_before,
        },
      })

      router.push("/dashboard/documents")
      router.refresh()
    } catch (e: any) {
      const msg = e instanceof ApiError ? e.message : e?.message || "Save failed"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  // Free blob URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const documentTypes = [
    { value: "lease", label: "Lease Agreement" },
    { value: "insurance", label: "Insurance Document" },
    { value: "inspection", label: "Inspection Report" },
    { value: "photo", label: "Property Photo" },
    { value: "receipt", label: "Receipt/Invoice" },
    { value: "contract", label: "Contract" },
    { value: "certificate", label: "Certificate" },
    { value: "legal", label: "Legal" },
    { value: "other", label: "Other" },
  ]

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Document Upload</CardTitle>
        <CardDescription>Upload and organize your property-related documents</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="file">Select File *</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              <input
                id="file"
                type="file"
                onChange={handleFileChange}
                className="hidden"
                accept={ACCEPTED_TYPES}
                disabled={uploading}
              />
              <label htmlFor="file" className="cursor-pointer">
                <div className="space-y-2">
                  {previewUrl ? (
                    <div className="space-y-2">
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="max-h-48 mx-auto rounded-md border"
                      />
                      <div className="flex items-center justify-center gap-1.5 text-sm font-medium break-all">
                        <File className="h-4 w-4 flex-shrink-0 text-primary" />
                        {selectedFile?.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {((selectedFile?.size || 0) / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </div>
                  ) : selectedFile ? (
                    <>
                      <File className="h-8 w-8 mx-auto text-primary" />
                      <div className="text-sm font-medium break-all">{selectedFile.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                      <div className="text-sm font-medium">Click to select a file</div>
                      <div className="text-xs text-muted-foreground">PDF, DOC, DOCX, JPG, PNG, GIF, TXT (Max 10MB)</div>
                    </>
                  )}
                </div>
              </label>
            </div>
            {selectedFile && !uploadedFile && (
              <Button type="button" onClick={handleUploadFile} disabled={uploading} variant="outline" className="w-full">
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading to Storage…
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload File
                  </>
                )}
              </Button>
            )}
            {uploadedFile && (
              <div className="flex items-center gap-2 text-sm text-chart-4 bg-chart-4/10 px-3 py-2 rounded-md">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <span>File uploaded successfully</span>
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Document Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Enter document name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Document Type *</Label>
              <Select value={formData.type} onValueChange={(value) => handleChange("type", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {documentTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="property_id">Associated Property (Optional)</Label>
              <Select value={formData.property_id} onValueChange={(value) => handleChange("property_id", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific property</SelectItem>
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.name} — {property.address}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant_id">Associated Tenant (Optional)</Label>
              <Select value={formData.tenant_id} onValueChange={(value) => handleChange("tenant_id", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select tenant" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific tenant</SelectItem>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenantName(tenant)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="Additional notes about this document..."
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="expiry_date">Expiry Date (Optional)</Label>
              <Input
                id="expiry_date"
                type="date"
                value={formData.expiry_date}
                onChange={(e) => handleChange("expiry_date", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Get a notification before this document expires.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reminder_days_before">Remind me (days before)</Label>
              <Input
                id="reminder_days_before"
                type="number"
                min={0}
                max={365}
                value={formData.reminder_days_before}
                onChange={(e) => handleChange("reminder_days_before", Number(e.target.value) || 30)}
                disabled={!formData.expiry_date}
              />
            </div>
          </div>

          <div className="flex gap-4">
            <Button type="submit" disabled={loading || !uploadedFile} className="bg-primary hover:bg-primary/90">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Save Document
                </>
              )}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
