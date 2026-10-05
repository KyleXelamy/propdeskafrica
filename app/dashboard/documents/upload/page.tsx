import { DocumentUploadForm } from "@/components/document-upload-form"

export default function UploadDocumentPage() {
  return (
    <div className="space-y-6 pt-2 md:pt-0">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Upload Document</h1>
        <p className="text-sm md:text-base text-muted-foreground">Add a new document to your property management system</p>
      </div>

      <DocumentUploadForm />
    </div>
  )
}
