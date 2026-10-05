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

export const openRoles: OpenRole[] = [
  {
    id: "senior-fullstack-engineer",
    title: "Senior Full-Stack Engineer",
    team: "Engineering",
    location: "Remote · Africa",
    type: "Full-time",
    excerpt:
      "Own meaningful surfaces of the I-Manage platform end-to-end. Next.js, Postgres, Supabase, M-Pesa. Help us scale from thousands to millions of units under management.",
  },
  {
    id: "product-designer",
    title: "Product Designer",
    team: "Design",
    location: "Remote · Africa",
    type: "Full-time",
    excerpt:
      "Lead the visual and interaction design for new landlord and tenant surfaces. You'll work directly with the founders and ship weekly.",
  },
  {
    id: "customer-success-lead",
    title: "Customer Success Lead",
    team: "Operations",
    location: "Nairobi, Kenya",
    type: "Full-time",
    excerpt:
      "Be the human voice of I-Manage for our Pro and Agency landlords. Onboarding, renewals, escalations and the occasional in-person visit.",
  },
  {
    id: "growth-marketer",
    title: "Growth Marketer",
    team: "Sales",
    location: "Hybrid",
    type: "Full-time",
    excerpt:
      "Own acquisition across content, paid, partnerships and lifecycle. You'll have a real budget and be expected to be opinionated about it.",
  },
  {
    id: "mobile-engineer-pwa",
    title: "Mobile Engineer (PWA)",
    team: "Engineering",
    location: "Remote · Africa",
    type: "Full-time",
    excerpt:
      "Push our Progressive Web App to feel native. Offline-first sync, push notifications, biometric auth. Real performance budgets, not vibes.",
  },
  {
    id: "support-engineer-intern",
    title: "Support Engineer (Internship)",
    team: "Operations",
    location: "Lagos, Nigeria",
    type: "Internship",
    excerpt:
      "6-month paid internship. You'll handle first-line support tickets, build macros, and ship one product improvement by the end of the program.",
  },
]

export type Testimonial = {
  quote: string
  name: string
  role: string
  company: string
  initials: string
  location: string
}

export const testimonials: Testimonial[] = [
  {
    quote:
      "I used to lose a full Saturday every month chasing late rent. I-Manage's M-Pesa reminders do it for me now. The Saturday is mine again.",
    name: "Brian Kiarie",
    role: "Landlord",
    company: "Kiarie Holdings",
    initials: "BK",
    location: "Nairobi",
  },
  {
    quote:
      "We manage 200+ units across three cities. I-Manage is the first tool that gave my property managers a single source of truth without a six-month rollout.",
    name: "Wanjiru M.",
    role: "Operations Director",
    company: "Highland Estates",
    initials: "WM",
    location: "Eldoret",
  },
  {
    quote:
      "Tenants actually like paying through the portal. Our collection rate went from 78% to 96% in our first quarter on the platform.",
    name: "Samuel O.",
    role: "Founder",
    company: "Coast Living",
    initials: "SO",
    location: "Mombasa",
  },
]

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

export const caseStudies: CaseStudy[] = [
  {
    slug: "highland-estates",
    company: "Highland Estates",
    industry: "Multi-family residential",
    units: "212 units",
    location: "Eldoret, Kenya",
    summary:
      "Highland Estates runs a growing portfolio of mid-market family homes. They adopted I-Manage to standardise reporting and replace four different spreadsheets.",
    results: [
      { label: "On-time collection", value: "78% → 96%" },
      { label: "Hours/month saved", value: "32h" },
      { label: "First-year ROI", value: "5.4×" },
    ],
    quote:
      "I-Manage is the first tool that made reporting something I look forward to sharing with my investors.",
    quoteAuthor: "Wanjiru M., Operations Director",
    cover:
      "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1600&q=80",
  },
  {
    slug: "coast-living",
    company: "Coast Living",
    industry: "Short-stay + long-stay hybrid",
    units: "84 units",
    location: "Mombasa, Kenya",
    summary:
      "Coast Living operates beach apartments with mixed nightly and monthly tenants. I-Manage's flexible lease model and M-Pesa STK Push fit their cashflow cycle.",
    results: [
      { label: "Tenant adoption", value: "92%" },
      { label: "Support tickets", value: "−41%" },
      { label: "M-Pesa fee savings", value: "KES 38k / mo" },
    ],
    quote:
      "Our tenants actually prefer paying through the portal — and so do we.",
    quoteAuthor: "Samuel O., Founder",
    cover:
      "https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=1600&q=80",
  },
]

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