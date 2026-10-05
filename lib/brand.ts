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
    "kenya-residential-lease": "/templates/kenya-residential-lease.txt",
    "kenya-month-to-month": "/templates/kenya-residential-lease.txt",
    "uganda-residential-lease": "/templates/kenya-residential-lease.txt",
    "tanzania-residential-lease": "/templates/kenya-residential-lease.txt",
    "move-in-inspection": "/templates/move-in-inspection.txt",
    "move-out-inspection": "/templates/move-out-inspection.txt",
    "rent-increase-notice": "/templates/rent-increase-notice.txt",
    "termination-notice": "/templates/termination-notice.txt",
    "rent-receipt-pdf": "/templates/rent-receipt.txt",
    "landlord-monthly-checklist": "/templates/landlord-monthly-checklist.txt",
    "csv-property-import": "/templates/property-import.csv",
    "commercial-lease-kenya": "/templates/kenya-residential-lease.txt",
  }
  return paths[slug] ?? "/templates/complaint-report.txt"
}
