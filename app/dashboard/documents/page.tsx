"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, FileText, ImageIcon, File, Download, Eye, Loader2 } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { formatDate, formatFileSize, tenantName } from "@/lib/utils"

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("documents")
          .select(`
            *,
            properties (name, address),
            tenants (full_name, first_name, last_name)
          `)
          .order("created_at", { ascending: false })

        if (error) throw error
        setDocuments(data || [])
      } catch (err: any) {
        console.error("[i-manage] documents fetch error", err)
        setError(err.message || "Failed to load documents")
      } finally {
        setLoading(false)
      }
    }
    fetchDocuments()
  }, [])

  const leaseDocuments = documents?.filter((doc) => doc.type === "lease") || []
  const insuranceDocuments = documents?.filter((doc) => doc.type === "insurance") || []
  const inspectionDocuments = documents?.filter((doc) => doc.type === "inspection") || []
  const photoDocuments = documents?.filter((doc) => doc.type === "photo") || []
  const otherDocuments =
    documents?.filter((doc) => !["lease", "insurance", "inspection", "photo"].includes(doc.type)) || []

  const getDocumentTypeColor = (type: string) => {
    switch (type) {
      case "lease":
        return "bg-primary text-primary-foreground"
      case "insurance":
        return "bg-chart-4 text-white"
      case "inspection":
        return "bg-secondary text-secondary-foreground"
      case "photo":
        return "bg-chart-2 text-white"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const getFileIcon = (mimeType?: string) => {
    if (mimeType?.startsWith("image/")) {
      return <ImageIcon className="h-4 w-4" />
    }
    return <FileText className="h-4 w-4" />
  }

  const DocumentCard = ({ document }: { document: any }) => (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 flex-1 min-w-0">
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="flex-shrink-0">{getFileIcon(document.mime_type)}</span>
              <span className="truncate">{document.name}</span>
            </CardTitle>
            <div className="text-sm text-muted-foreground space-y-0.5">
              {document.properties && <div className="truncate">{document.properties.name} •</div>}
              {document.tenants && <div className="truncate">{tenantName(document.tenants)} •</div>}
              <div>{formatDate(document.created_at)}</div>
            </div>
          </div>
          <Badge className={`${getDocumentTypeColor(document.type)} flex-shrink-0`}>{document.type}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">File Size:</span>
          <span>{formatFileSize(document.file_size)}</span>
        </div>

        {document.notes && <p className="text-sm text-muted-foreground line-clamp-2">{document.notes}</p>}

        <div className="flex gap-2 pt-2">
          {document.file_url && (
            <>
              <Button variant="outline" size="sm" asChild className="flex-1 bg-transparent">
                <a href={document.file_url} target="_blank" rel="noopener noreferrer">
                  <Eye className="h-3 w-3 mr-1" />
                  View
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild className="flex-1 bg-transparent">
                <a href={document.file_url} download>
                  <Download className="h-3 w-3 mr-1" />
                  Download
                </a>
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6 pt-2 md:pt-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Documents</h1>
          <p className="text-sm md:text-base text-muted-foreground">Manage property documents, leases, and files</p>
        </div>
        <Button asChild className="bg-primary hover:bg-primary/90 w-full sm:w-auto">
          <Link href="/dashboard/documents/upload">
            <Plus className="h-4 w-4 mr-2" />
            Upload Document
          </Link>
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
                <File className="h-4 w-4 text-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{documents?.length || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Leases</CardTitle>
                <FileText className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{leaseDocuments.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Insurance</CardTitle>
                <FileText className="h-4 w-4 text-chart-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-chart-4">{insuranceDocuments.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Inspections</CardTitle>
                <FileText className="h-4 w-4 text-secondary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-secondary">{inspectionDocuments.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Photos</CardTitle>
                <ImageIcon className="h-4 w-4 text-chart-2" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-chart-2">{photoDocuments.length}</div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="all" className="space-y-4">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="all">All ({documents?.length || 0})</TabsTrigger>
              <TabsTrigger value="leases">Leases ({leaseDocuments.length})</TabsTrigger>
              <TabsTrigger value="insurance">Insurance ({insuranceDocuments.length})</TabsTrigger>
              <TabsTrigger value="inspections">Inspections ({inspectionDocuments.length})</TabsTrigger>
              <TabsTrigger value="photos">Photos ({photoDocuments.length})</TabsTrigger>
              <TabsTrigger value="other">Other ({otherDocuments.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="space-y-4">
              {documents && documents.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {documents.map((document) => (
                    <DocumentCard key={document.id} document={document} />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">No documents uploaded yet</p>
                    <Button asChild>
                      <Link href="/dashboard/documents/upload">
                        <Plus className="h-4 w-4 mr-2" />
                        Upload First Document
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            <TabsContent value="leases" className="space-y-4">
              {leaseDocuments.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {leaseDocuments.map((document) => (
                    <DocumentCard key={document.id} document={document} />
                  ))}
                </div>
              ) : (
                <Card><CardContent className="text-center py-8"><p className="text-muted-foreground">No lease documents found</p></CardContent></Card>
              )}
            </TabsContent>
            <TabsContent value="insurance" className="space-y-4">
              {insuranceDocuments.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {insuranceDocuments.map((document) => (
                    <DocumentCard key={document.id} document={document} />
                  ))}
                </div>
              ) : (
                <Card><CardContent className="text-center py-8"><p className="text-muted-foreground">No insurance documents found</p></CardContent></Card>
              )}
            </TabsContent>
            <TabsContent value="inspections" className="space-y-4">
              {inspectionDocuments.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {inspectionDocuments.map((document) => (
                    <DocumentCard key={document.id} document={document} />
                  ))}
                </div>
              ) : (
                <Card><CardContent className="text-center py-8"><p className="text-muted-foreground">No inspection documents found</p></CardContent></Card>
              )}
            </TabsContent>
            <TabsContent value="photos" className="space-y-4">
              {photoDocuments.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {photoDocuments.map((document) => (
                    <DocumentCard key={document.id} document={document} />
                  ))}
                </div>
              ) : (
                <Card><CardContent className="text-center py-8"><p className="text-muted-foreground">No photos found</p></CardContent></Card>
              )}
            </TabsContent>
            <TabsContent value="other" className="space-y-4">
              {otherDocuments.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {otherDocuments.map((document) => (
                    <DocumentCard key={document.id} document={document} />
                  ))}
                </div>
              ) : (
                <Card><CardContent className="text-center py-8"><p className="text-muted-foreground">No other documents found</p></CardContent></Card>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}
