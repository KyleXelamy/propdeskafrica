export const BRAND = {
  product: "I-Manage",
  company: "I-Manage",
  creator: "Brian Kiarie",
  supportEmail: "bknglabs.dev@gmail.com",
  supportPhone: "0758034649",
  supportPhoneHref: "tel:+254758034649",
} as const

export function supportMailto(subject: string, body: string) {
  return `mailto:${BRAND.supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export function templateDownloadPath(slug: string) {
  const paths: Record<string, string> = {
    "kenya-residential-lease": "/templates/preview/lease.docx",
    "kenya-month-to-month": "/templates/preview/lease.docx",
    "uganda-residential-lease": "/templates/preview/lease.docx",
    "tanzania-residential-lease": "/templates/preview/lease.docx",
    "move-in-inspection": "/templates/preview/inspection.docx",
    "move-out-inspection": "/templates/preview/inspection.docx",
    "rent-increase-notice": "/templates/preview/rent-increase.docx",
    "termination-notice": "/templates/preview/termination.docx",
    "rent-receipt-pdf": "/templates/preview/receipt.docx",
    "landlord-monthly-checklist": "/templates/preview/checklist.docx",
    "csv-property-import": "/templates/property-import.csv",
    "commercial-lease-kenya": "/templates/preview/lease.docx",
  }
  return paths[slug] ?? "/templates/preview/complaint.docx"
}
