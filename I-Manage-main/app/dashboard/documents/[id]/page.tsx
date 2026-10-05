"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Download, Eye, Edit, FileText, ImageIcon, File, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { DeleteButton } from "@/components/delete-button"
import { formatDate, formatFileSize, tenantName } from "@/lib/utils"

export default function DocumentDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [document, setDocument] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!params?.id) return
    const fetchDocument = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("documents")
          .select(`
            *,
            properties(id, name, address),
            tenants(full_name, first_name, last_name)
          `)
          .eq("id", params.id)
          .maybeSingle()
        if (error) throw error
        if (!data) setNotFound(true)
        else setDocument(data)
      } catch (error) {
        console.error("[i-manage] fetch document error", error)
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    fetchDocument()
  }, [params?.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (notFound || !document) {
    return (
      <div className="text-center py-10 space-y-4">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
        <h3 className="text-lg font-medium">Document not found</h3>
        <Button onClick={() => router.push("/dashboard/documents")} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Documents
        </Button>
      </div>
    )
  }

  const getFileIcon = (mimeType?: string) => {
    if (mimeType?.startsWith("image/")) return <ImageIcon className="h-5 w-5" />
    if (mimeType?.includes("pdf")) return <FileText className="h-5 w-5" />
    return <File className="h-5 w-5" />
  }

  const isImage = document.mime_type?.startsWith("image/")

  return (
    <div className="space-y-6 pt-2 md:pt-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/documents")} className="flex-shrink-0 mt-1">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to Documents</span>
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground truncate">{document.name}</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Uploaded {formatDate(document.created_at)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {document.file_url && (
            <>
              <Button variant="outline" size="sm" asChild>
                <a href={document.file_url} target="_blank" rel="noopener noreferrer">
                  <Eye className="h-4 w-4 mr-2" />
                  View
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={document.file_url} download>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </a>
              </Button>
            </>
          )}
          <DeleteButton
            endpoint={`/api/documents/${document.id}`}
            resource="document"
            redirectTo="/dashboard/documents"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {getFileIcon(document.mime_type)}
                Document Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/30 rounded-lg p-8 text-center">
                {isImage && document.file_url ? (
                  <img
                    src={document.file_url}
                    alt={document.name}
                    className="max-w-full h-auto mx-auto rounded-lg"
                  />
                ) : (
                  <div className="space-y-4">
                    {getFileIcon(document.mime_type)}
                    <div>
                      <p className="font-medium">{document.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {document.mime_type || "Unknown type"} • {formatFileSize(document.file_size)}
                      </p>
                    </div>
                    {document.file_url && (
                      <Button asChild>
                        <a href={document.file_url} target="_blank" rel="noopener noreferrer">
                          <Eye className="h-4 w-4 mr-2" />
                          Open Document
                        </a>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Document Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Type</p>
                <Badge variant="secondary" className="mt-1">{document.type}</Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">File Size</p>
                <p className="text-sm">{formatFileSize(document.file_size)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Uploaded</p>
                <p className="text-sm">{formatDate(document.created_at)}</p>
              </div>
              {document.notes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{document.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {(document.properties || document.tenants) && (
            <Card>
              <CardHeader>
                <CardTitle>Associated With</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {document.properties && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Property</p>
                    <p className="text-sm">
                      <Link href={`/dashboard/properties/${document.properties.id}`} className="text-primary hover:underline">
                        {document.properties.name}
                      </Link>
                    </p>
                    <p className="text-xs text-muted-foreground">{document.properties.address}</p>
                  </div>
                )}
                {document.tenants && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Tenant</p>
                    <p className="text-sm">{tenantName(document.tenants)}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
