/**
 * I-Manage website content that powers Careers, Customers, Press,
 * Changelog, Status and Integrations. All data is static until a CMS
 * is wired in — easy to swap for a remote source later.
 */

export type OpenRole = {
  id: string
  title: string
  team: "Engineering" | "Product" | "Design" | "Operations" | "Sales"
  location: "Remote · Africa" | "Nairobi, Kenya" | "Lagos, Nigeria" | "Hybrid"
  type: "Full-time" | "Contract" | "Internship"
  excerpt: string
}

export const openRoles: OpenRole[] = []


export type CaseStudy = {
  slug: string
  company: string
  industry: string
  units: string
  location: string
  summary: string
  results: { label: string; value: string }[]
  quote: string
  quoteAuthor: string
  cover: string
}

export const caseStudies: CaseStudy[] = []



export type ChangelogEntry = {
  version: string
  date: string
  title: string
  type: "feature" | "improvement" | "fix" | "security"
  body: string
}

export const changelog: ChangelogEntry[] = [
  {
    version: "v2.6.0",
    date: "2026-10-01",
    title: "M-Pesa STK Push with auto-retry",
    type: "feature",
    body:
      "Tenants now get a fresh STK Push every 12 hours until they pay. Failed prompts are surfaced in the landlord inbox, not silently dropped.",
  },
  {
    version: "v2.5.4",
    date: "2026-09-22",
    title: "Document expiry reminders",
    type: "improvement",
    body:
      "Lease and insurance documents now warn 30 / 14 / 7 days before expiry. Configurable per portfolio.",
  },
  {
    version: "v2.5.3",
    date: "2026-09-15",
    title: "Faster dashboard",
    type: "improvement",
    body: "Initial dashboard render is 38% faster for portfolios with 100+ units. Cached aggregate queries under the hood.",
  },
  {
    version: "v2.5.0",
    date: "2026-09-01",
    title: "Tenant portal v2",
    type: "feature",
    body:
      "Tenants can now pay rent, view their lease, raise maintenance, and download their statement — all from a phone-first portal.",
  },
  {
    version: "v2.4.2",
    date: "2026-08-18",
    title: "CSV import for properties, tenants, payments",
    type: "feature",
    body: "Migrating from a spreadsheet? The new CSV import walks you through mapping and validates every row before commit.",
  },
  {
    version: "v2.4.0",
    date: "2026-08-01",
    title: "Recurring expenses",
    type: "feature",
    body:
      "Set up monthly insurance, security, service charges and more. I-Manage logs them automatically and reminds you to attach receipts.",
  },
  {
    version: "v2.3.1",
    date: "2026-07-12",
    title: "Login rate limiting + audit log",
    type: "security",
    body: "Added per-IP rate limiting on /auth/login and a tamper-evident audit log for sensitive actions.",
  },
  {
    version: "v2.3.0",
    date: "2026-07-01",
    title: "Reports v2",
    type: "feature",
    body:
      "Property-level and portfolio-level reports. Compare months, export to PDF, share read-only links with your accountant.",
  },
]

export type Integration = {
  name: string
  category: "Payments" | "Accounting" | "Communication" | "Storage" | "Productivity"
  description: string
  status: "Live" | "Beta" | "Coming soon"
  href: string
}

export const integrations: Integration[] = [
  {
    name: "M-Pesa (Safaricom Daraja)",
    category: "Payments",
    description: "STK Push, B2C payouts, and automatic reconciliation. The default for Kenya.",
    status: "Live",
    href: "https://developer.safaricom.co.ke",
  },
  {
    name: "Airtel Money",
    category: "Payments",
    description: "STK-style push for Airtel subscribers across East Africa.",
    status: "Live",
    href: "https://developer.airtel.africa",
  },
  {
    name: "Xero",
    category: "Accounting",
    description: "Daily sync of rent receipts and expenses to your Xero ledger.",
    status: "Beta",
    href: "https://www.xero.com",
  },
  {
    name: "QuickBooks",
    category: "Accounting",
    description: "Two-way sync for landlords who already run QuickBooks.",
    status: "Coming soon",
    href: "https://quickbooks.intuit.com",
  },
  {
    name: "WhatsApp Business",
    category: "Communication",
    description: "Send payment reminders, lease updates and maintenance notes to tenants via WhatsApp.",
    status: "Live",
    href: "https://business.whatsapp.com",
  },
  {
    name: "Google Drive",
    category: "Storage",
    description: "Mirror your document vault to Google Drive for offsite backup.",
    status: "Live",
    href: "https://drive.google.com",
  },
  {
    name: "Slack",
    category: "Communication",
    description: "Get rent and maintenance notifications in a team channel.",
    status: "Live",
    href: "https://slack.com",
  },
  {
    name: "Notion",
    category: "Productivity",
    description: "Embed live I-Manage widgets in your internal Notion docs.",
    status: "Coming soon",
    href: "https://www.notion.so",
  },
]

export type SystemComponent = {
  key: string
  name: string
  description: string
}

export const systemComponents: SystemComponent[] = [
  { key: "marketing", name: "Marketing site", description: "i-manage.app, marketing content and blog." },
  { key: "auth", name: "Authentication", description: "Sign in, sign up, password reset, email verification." },
  { key: "dashboard", name: "Landlord dashboard", description: "Properties, tenants, payments, expenses, reports." },
  { key: "portal", name: "Tenant portal", description: "Tenant self-service payments and maintenance." },
  { key: "mpesa", name: "M-Pesa / Daraja", description: "STK Push, B2C callbacks, reconciliation." },
  { key: "webhooks", name: "Outbound webhooks", description: "Agency-tier event delivery to your endpoints." },
]

export type StatusIncident = {
  id: string
  date: string
  title: string
  status: "Resolved" | "Monitoring" | "Investigating"
  severity: "minor" | "major" | "critical"
  body: string
}

export const statusIncidents: StatusIncident[] = [
  {
    id: "INC-2026-10-02",
    date: "2026-10-02",
    title: "Elevated STK Push latency",
    status: "Resolved",
    severity: "minor",
    body:
      "From 14:08 to 14:47 EAT, some M-Pesa STK Push requests took longer than usual to surface the prompt on the customer's phone. We rerouted around a Daraja edge node and re-tested at 14:55.",
  },
  {
    id: "INC-2026-09-21",
    date: "2026-09-21",
    title: "Reports page slow on large portfolios",
    status: "Resolved",
    severity: "minor",
    body:
      "Portfolios with 500+ units saw reports take 8–12s to render. We shipped a caching fix in v2.5.3 that brings it back to under 2s.",
  },
  {
    id: "INC-2026-09-04",
    date: "2026-09-04",
    title: "Email delivery degraded",
    status: "Resolved",
    severity: "major",
    body:
      "Transactional emails were queued but not sent for ~40 minutes due to an upstream provider issue. We migrated to a backup provider and queued messages were flushed at 12:18 EAT.",
  },
]
