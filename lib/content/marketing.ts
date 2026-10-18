/**
 * PropDesk Africa marketing content: features, solutions, docs, templates,
 * roadmap, customers detail, etc. Static until we wire up a CMS.
 */

export type Feature = {
  slug: string
  name: string
  tagline: string
  summary: string
  bullets: string[]
  icon: string // lucide icon name
  image?: string
}

export const features: Feature[] = [
  {
    slug: "paybill-integration",
    name: "Paybill integration",
    tagline: "Tenants pay your paybill. You see it instantly.",
    summary:
      "Assign a dedicated Safaricom paybill or till number per property. Tenants pay with M-Pesa the way they already do — the system detects, matches and reconciles automatically.",
    bullets: [
      "Per-property paybill / till numbers",
      "Auto-matching to tenants via account reference",
      "Daraja C2B validation URL wired in",
      "Instant SMS + email receipts to landlord",
      "Fallback to STK Push for non-M-Pesa tenants",
    ],
    icon: "Wallet",
    image:
      "https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?auto=format&fit=crop&w=1600&q=80",
  },
  {
    slug: "tenant-records",
    name: "Tenant records",
    tagline: "Every tenant. Every contact. Every lease.",
    summary:
      "One searchable record per tenant — contact details, lease history, ID, deposit, payment history, maintenance tickets, photos of damage, and every document attached. No tenant login needed.",
    bullets: [
      "Unlimited tenant records per landlord",
      "Contact, ID and KYC document storage",
      "Lease history and renewal tracking",
      "Payment + maintenance timeline per tenant",
      "Bulk import from CSV",
    ],
    icon: "Users",
    image:
      "/propdesk-property-operations.png",
  },
  {
    slug: "quotations",
    name: "Quotations & approvals",
    tagline: "Get quotes, approve, track, pay.",
    summary:
      "When a maintenance issue comes up, request quotes from multiple contractors in one click. Compare, approve, and track the work — all from the same record. No more WhatsApp quote threads.",
    bullets: [
      "Request quotes from your contractor list",
      "Side-by-side comparison",
      "Approve with one click",
      "Auto-convert approved quote to invoice",
      "Track budget vs. actual per property",
    ],
    icon: "FileText",
    image:
      "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1600&q=80",
  },
  {
    slug: "damages-tracking",
    name: "Damages & inspections",
    tagline: "See every scratch. Track every repair.",
    summary:
      "Photo-document move-in condition, log damages as they happen with date and severity, attach repair costs and resolution. Use at exit to settle deposits fairly.",
    bullets: [
      "Room-by-room inspection checklists",
      "Photo + video damage logs",
      "Severity and repair status",
      "Linked to maintenance + invoices",
      "Move-in vs. move-out comparison",
    ],
    icon: "ShieldAlert",
    image:
      "https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=1600&q=80",
  },
  {
    slug: "rent-collection",
    name: "Rent collection",
    tagline: "Collect rent on autopilot.",
    summary:
      "Native M-Pesa STK Push, automatic reminders, and reconciliation against Daraja's transaction log. Late rent drops to single digits.",
    bullets: [
      "STK Push that works on flaky networks",
      "Auto-retry with tenant consent",
      "Daily reconciliation against Daraja",
      "Receipts sent automatically",
      "Multi-currency (KES, UGX, TZS, NGN, USD)",
    ],
    icon: "Banknote",
    image:
      "https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?auto=format&fit=crop&w=1600&q=80",
  },
  {
    slug: "maintenance",
    name: "Maintenance workflows",
    tagline: "From issue to receipt, in one place.",
    summary:
      "Log a maintenance issue, get estimates from contractors, approve the work, attach receipts. Every step tracked and costed against the property.",
    bullets: [
      "Photo + video attachments",
      "Contractor database",
      "Quote → invoice flow",
      "Priority and SLA tracking",
      "Cost vs. estimate reports",
    ],
    icon: "Wrench",
    image:
      "https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=1600&q=80",
  },
  {
    slug: "documents",
    name: "Document vault",
    tagline: "Every lease, every receipt, findable.",
    summary:
      "Encrypted document storage with OCR, expiry tracking and role-based access. Stop emailing PDFs back and forth.",
    bullets: [
      "Encrypted at rest and in transit",
      "Automatic lease-expiry reminders",
      "OCR for receipts and contracts",
      "Granular access controls",
      "Audit log for every download",
    ],
    icon: "FolderLock",
    image:
      "https://images.unsplash.com/photo-1568667256549-094345857637?auto=format&fit=crop&w=1600&q=80",
  },
  {
    slug: "reports",
    name: "Reports & exports",
    tagline: "Numbers your accountant will actually like.",
    summary:
      "Real-time cashflow, occupancy, arrears and yield reports. Export to PDF or CSV. Share with your accountant on a read-only link.",
    bullets: [
      "Cashflow, arrears, occupancy, yield",
      "Property and portfolio views",
      "PDF / CSV / accountant link",
      "Compare periods",
      "Multi-currency consolidation",
    ],
    icon: "BarChart3",
    image:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=80",
  },
  {
    slug: "expenses",
    name: "Expenses & receipts",
    tagline: "Log it once, forget about it.",
    summary:
      "Snap a photo of the receipt, set it to recur monthly, and we'll log it automatically. Recurring expenses covered: insurance, security, service charges, utilities.",
    bullets: [
      "Photo capture from phone",
      "Recurring expense schedules",
      "Property and portfolio rollups",
      "Receipt expiry reminders",
      "Xero / QuickBooks export",
    ],
    icon: "Receipt",
    image:
      "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1600&q=80",
  },
  {
    slug: "multi-property",
    name: "Multi-property",
    tagline: "One portfolio. One view.",
    summary:
      "Manage residential, commercial, mixed and short-stay properties in the same workspace. Tag, filter and report across your entire portfolio.",
    bullets: [
      "Mixed-use portfolios",
      "Custom tags and segments",
      "Bulk actions across units",
      "Custom fields per property type",
      "Portfolio-level dashboards",
    ],
    icon: "Building2",
    image:
      "https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&w=1600&q=80",
  },
  {
    slug: "contacts",
    name: "Contacts & contractors",
    tagline: "Tenants, contractors, agents, owners — all in one rolodex.",
    summary:
      "A single address book for everyone in your property world. Call, email and message from the record. Every interaction logged against the right property.",
    bullets: [
      "Tenants, contractors, agents, owners",
      "One-click call / WhatsApp / email",
      "Activity timeline per contact",
      "Cross-property search",
      "Bulk import + dedupe",
    ],
    icon: "Contact",
    image:
      "/propdesk-property-operations.png",
  },
  {
    slug: "company-view",
    name: "Company & agency view",
    tagline: "Multiple landlords. One operating picture.",
    summary:
      "For agencies and property managers. Manage multiple landlords under one roof with separate accounts, role-based access and aggregate reporting across the whole book.",
    bullets: [
      "Multi-landlord accounts",
      "Role-based access (admin, manager, viewer)",
      "Aggregate cashflow and occupancy",
      "Per-landlord profit & loss",
      "White-label tenant comms (Agency plan)",
    ],
    icon: "Briefcase",
    image:
      "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80",
  },
  {
    slug: "developer-api",
    name: "Developer API & webhooks",
    tagline: "Wire PropDesk Africa into your stack.",
    summary:
      "Full REST API + signed webhooks for Agency and Enterprise. Build custom integrations, automate workflows, pipe data into your data warehouse.",
    bullets: [
      "REST endpoints for every entity",
      "Signed webhook events",
      "OAuth for partner integrations",
      "OpenAPI spec",
      "Sandbox + production keys",
    ],
    icon: "Code2",
    image:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1600&q=80",
  },
]

export type Solution = {
  slug: string
  name: string
  tagline: string
  audience: string
  summary: string
  outcomes: { label: string; value: string }[]
  image: string
}

export const solutions: Solution[] = [
  {
    slug: "solo-landlord",
    name: "For solo landlords",
    tagline: "From one unit to ten.",
    audience: "Individual landlords managing their own properties.",
    summary:
      "You're running your properties on weekends and WhatsApp. PropDesk Africa replaces the spreadsheet with one calm workspace — without making you a software expert.",
    outcomes: [],
    image: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1600&q=80",
  },
  {
    slug: "property-agencies",
    name: "For property agencies",
    tagline: "Multi-landlord, multi-team.",
    audience: "Property management agencies with their own landlord clients.",
    summary:
      "Run your entire book under one roof with separate landlord accounts, role-based access and SLA-backed support.",
    outcomes: [],
    image: "https://images.unsplash.com/photo-1554469384-e58fac16e23a?auto=format&fit=crop&w=1600&q=80",
  },
  {
    slug: "commercial",
    name: "For commercial landlords",
    tagline: "Office, retail, industrial.",
    audience: "Owners and operators of commercial real estate.",
    summary:
      "Multi-tenant leases, CAM charges, rent escalations, percentage rent and triple-net — handled natively. Xero and QuickBooks sync ready.",
    outcomes: [],
    image: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80",
  },
  {
    slug: "vacation-rental",
    name: "For vacation & short-stay",
    tagline: "Nightly and monthly, one ledger.",
    audience: "Airbnb-style and hybrid nightly + monthly operators.",
    summary:
      "Track nightly, weekly and monthly stays in the same workspace. Sync with Booking.com and Airbnb. Reconcile across platforms automatically.",
    outcomes: [],
    image: "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1600&q=80",
  },
  {
    slug: "developer",
    name: "For developers",
    tagline: "Build on PropDesk Africa.",
    audience: "Agencies and SaaS companies integrating property operations.",
    summary:
      "Full REST API, signed webhooks, OAuth and an OpenAPI spec. Build custom tenant experiences, automate workflows and pipe data anywhere.",
    outcomes: [
      { label: "Time to first API call", value: "< 10 min" },
      { label: "Webhook reliability", value: "99.99%" },
      { label: "Support response", value: "< 4h" },
    ],
    image: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1600&q=80",
  },
  {
    slug: "enterprise",
    name: "For enterprise",
    tagline: "Procurement-ready, SOC-aligned.",
    audience: "Funds, REITs and large operators with formal procurement.",
    summary:
      "Dedicated tenancy, SSO, custom SLAs, on-prem option and a named success manager. Signed BAAs, DPAs and SOC reports on request.",
    outcomes: [
      { label: "Compliance review", value: "Weeks → days" },
      { label: "Onboarding support", value: "Named CSM" },
      { label: "Uptime SLA", value: "99.95%" },
    ],
    image: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=80",
  },
]

export type DocCategory = {
  slug: string
  name: string
  description: string
}

export const docCategories: DocCategory[] = [
  { slug: "getting-started", name: "Getting started", description: "Set up your first portfolio in under 15 minutes." },
  { slug: "guides", name: "Guides", description: "Step-by-step playbooks for every workflow." },
  { slug: "api", name: "API reference", description: "REST endpoints, webhooks and OAuth." },
  { slug: "integrations", name: "Integrations", description: "M-Pesa, Xero, WhatsApp and the rest of your stack." },
  { slug: "security", name: "Security", description: "Encryption, compliance and data handling." },
  { slug: "billing", name: "Billing & accounts", description: "Plans, invoices and account management." },
]

export type DocArticle = {
  slug: string
  category: string
  title: string
  excerpt: string
  readingMinutes: number
  body: string
  updated: string
}

export const docArticles: DocArticle[] = [
  {
    slug: "quickstart",
    category: "getting-started",
    title: "Quickstart: set up PropDesk Africa in 15 minutes",
    excerpt: "From a fresh account to your first collected rent in under 15 minutes.",
    readingMinutes: 4,
    updated: "2026-09-22",
    body: `This quickstart walks you through the fastest path to a working PropDesk Africa account. We'll create a property, add a tenant, send a rent invoice and confirm the dashboard reflects it.

## Before you start

You'll need an PropDesk Africa account (free tier is fine), a property to manage, and a phone that can take M-Pesa prompts.

## Step 1 — Create a property

From the dashboard, click **Properties → New property**. Fill in name, address, monthly rent, currency and the lease start date. Photos are optional but encouraged.

## Step 2 — Invite a tenant

Click **Tenants → New** and enter the tenant's name, phone and email. They show up immediately as a record — no invite, no portal login, no extra steps. The record auto-links to every payment that comes in via your paybill.

## Step 3 — Send your first rent invoice

Open the tenant's profile and click **Request rent**. Set the amount (KES 25,000 in our example), the due date and click **Send STK Push**. The tenant gets a prompt on their phone within 10 seconds.

## Step 4 — Confirm the payment

As soon as the tenant enters their PIN, the dashboard updates with a receipt. A copy is emailed to both of you automatically.

That's it — you've collected your first rent. The rest of PropDesk Africa is layering more workflows on top of these same four steps.`,
  },
  {
    slug: "first-property",
    category: "getting-started",
    title: "Add your first property",
    excerpt: "The fastest way to create a clean property record.",
    readingMinutes: 3,
    updated: "2026-09-12",
    body: `Adding a property is the first action every landlord takes. Here's the minimum information you need and the optional fields we recommend filling in from day one.

## Required fields

- **Name** — anything you recognise ("Westlands Studio", "Karen House 1")
- **Type** — House, Apartment, Maisonette, Bedsitter, Studio, Land, Commercial
- **Address** — street + neighbourhood
- **Monthly rent** — in your account currency
- **Status** — Available, Rented, Under Maintenance

## Recommended fields

- Photos (drag and drop, up to 20 per property)
- Amenities (Water, Parking, WiFi, Security, Garden…)
- Description (what makes this unit attractive)

## What we generate for you

Once you save, we automatically create a draft lease template and a default tenant record schema. You can edit both later from Settings.`,
  },
  {
    slug: "invite-tenant",
    category: "getting-started",
    title: "Invite a tenant",
    excerpt: "Send a magic-link invite so the tenant can self-onboard.",
    readingMinutes: 2,
    updated: "2026-09-10",
    body: `Inviting a tenant is intentionally fast — name, phone, email. We send them a magic link that takes them through KYC, lease signing and their first payment.

## What tenants see

1. A branded welcome message with your name and logo (if Agency plan)
2. A KYC form (ID upload, phone verification)
3. A lease preview (the same one you see in the dashboard)
4. A "Pay first month's rent" button

If the tenant abandons at any step, you can resume the flow on their behalf from the dashboard.`,
  },
  {
    slug: "stk-push-flow",
    category: "guides",
    title: "How STK Push rent collection works",
    excerpt: "What happens from the moment you click Request rent to the money hitting your account.",
    readingMinutes: 5,
    updated: "2026-09-30",
    body: `STK Push is Safaricom's recommended way to collect rent programmatically. This guide explains what PropDesk Africa does under the hood.

## The 30-second version

1. You click **Request rent** for a tenant
2. We call Daraja's STK Push endpoint with the tenant's phone + amount
3. Safaricom sends a prompt to the tenant's phone
4. Tenant enters their PIN (or cancels)
5. Daraja posts a callback to our \`/api/mpesa/callback\` endpoint
6. We update the ledger and email both parties a confirmation

## What we do when it goes wrong

The most common failure modes:

- **Phone offline** → the prompt never arrives. We surface this in your dashboard within 90 seconds.
- **Customer cancels** → we mark the request as "cancelled" and you can re-trigger with one click.
- **Callback never arrives** → our reconciliation pass picks it up from Daraja's transaction log every night.

## Auto-retry (Pro plan)

If the customer doesn't pay within 12 hours, we automatically re-send the prompt — with their consent recorded the first time.`,
  },
  {
    slug: "bulk-import",
    category: "guides",
    title: "Bulk import properties from a CSV",
    excerpt: "Migrate from a spreadsheet in a single afternoon.",
    readingMinutes: 4,
    updated: "2026-08-15",
    body: `If you're managing more than 10 properties in a spreadsheet, bulk import will save you a weekend. Here's the format.

## CSV columns

- name, type, address, city, county
- rent_amount, currency, status
- amenities (semicolon-separated)
- description

We validate every row before commit. Bad rows show up in a download-able report with the exact issue highlighted.

## What gets created

For every row that passes validation:

- A new property record
- A draft lease template
- A placeholder tenant slot

You can then bulk-invite tenants in a second pass.`,
  },
  {
    slug: "webhooks",
    category: "api",
    title: "Webhooks overview",
    excerpt: "Receive real-time notifications when things happen in PropDesk Africa.",
    readingMinutes: 6,
    updated: "2026-09-05",
    body: `Webhooks let you react to events in PropDesk Africa from your own backend. Available on the Agency and Enterprise plans.

## Event types

- \`payment.received\`
- \`payment.failed\`
- \`tenant.invited\`
- \`tenant.activated\`
- \`maintenance.requested\`
- \`maintenance.completed\`
- \`lease.expiring\` (30 / 14 / 7 days)
- \`document.uploaded\`
- \`document.expiring\` (30 / 14 / 7 days)

## Signing

Every webhook is signed with an HMAC-SHA256 of the body using your endpoint secret. Verify the \`X-PropDesk Africa-Signature\` header before trusting the payload.

## Retries

Failed deliveries (non-2xx) are retried with exponential backoff up to 24 hours. Inspect the delivery log from your dashboard.`,
  },
  {
    slug: "oauth",
    category: "api",
    title: "OAuth 2.0 for partner integrations",
    excerpt: "Let third-party apps act on a landlord's behalf — with their consent.",
    readingMinutes: 5,
    updated: "2026-08-20",
    body: `PropDesk Africa supports OAuth 2.0 authorization-code flows for partner integrations.

## Scopes

- \`properties:read\`
- \`properties:write\`
- \`tenants:read\`
- \`tenants:write\`
- \`payments:read\`
- \`payments:write\`
- \`webhooks:manage\`

## Token lifetimes

- Access tokens: 1 hour
- Refresh tokens: 90 days, rotated on use

## Rate limits

60 req/min per token, 1000 req/hour per partner. Bursts above the per-minute limit return HTTP 429 with a \`Retry-After\` header.`,
  },
  {
    slug: "xero-integration",
    category: "integrations",
    title: "Connect Xero",
    excerpt: "Sync rent receipts and expenses to your Xero ledger daily.",
    readingMinutes: 3,
    updated: "2026-09-15",
    body: `The Xero integration (currently in Beta) syncs two ledger types:

- **Rent payments** — credited to your rental income account
- **Expenses** — debited to your chosen expense category

## Setup

Settings → Integrations → Xero → Connect. Authorise PropDesk Africa to read your chart of accounts and create draft invoices. We never post without your approval.`,
  },
]

export type Template = {
  slug: string
  name: string
  category: "Lease" | "Inspection" | "Notice" | "Receipt" | "Checklist"
  description: string
  downloads: number
  format: "PDF" | "DOCX" | "CSV"
  region: string
  downloadPath?: string
}

export const templates: Template[] = [
  {
    slug: "kenya-residential-lease",
    name: "Kenya Residential Lease (1-year)",
    category: "Lease",
    description: "Plain-English residential lease compliant with the Kenya Landlord & Tenant Act.",
    downloads: 28,
    format: "DOCX",
    region: "Kenya",
  },
  {
    slug: "kenya-month-to-month",
    name: "Kenya Month-to-Month Agreement",
    category: "Lease",
    description: "Short-form lease for month-to-month tenancies.",
    downloads: 24,
    format: "DOCX",
    region: "Kenya",
  },
  {
    slug: "uganda-residential-lease",
    name: "Uganda Residential Lease",
    category: "Lease",
    description: "Residential lease template drafted for Ugandan tenancy law.",
    downloads: 22,
    format: "DOCX",
    region: "Uganda",
  },
  {
    slug: "tanzania-residential-lease",
    name: "Tanzania Residential Lease",
    category: "Lease",
    description: "Bilingual (Swahili + English) residential lease for Tanzania.",
    downloads: 21,
    format: "DOCX",
    region: "Tanzania",
  },
  {
    slug: "move-in-inspection",
    name: "Move-in Inspection Checklist",
    category: "Inspection",
    description: "Room-by-room inspection template with photo slots.",
    downloads: 26,
    format: "DOCX",
    region: "Pan-African",
  },
  {
    slug: "move-out-inspection",
    name: "Move-out Inspection Checklist",
    category: "Inspection",
    description: "Mirror of the move-in template for fair deposit deductions.",
    downloads: 23,
    format: "DOCX",
    region: "Pan-African",
  },
  {
    slug: "rent-increase-notice",
    name: "Rent Increase Notice (30-day)",
    category: "Notice",
    description: "Politely-worded 30-day notice for rent adjustments.",
    downloads: 20,
    format: "DOCX",
    region: "Pan-African",
  },
  {
    slug: "termination-notice",
    name: "Termination Notice",
    category: "Notice",
    description: "Mutual termination notice template.",
    downloads: 20,
    format: "DOCX",
    region: "Pan-African",
  },
  {
    slug: "rent-receipt-pdf",
    name: "Rent Receipt (auto-fill)",
    category: "Receipt",
    description: "PDF receipt that auto-fills from your PropDesk Africa payment record.",
    downloads: 29,
    format: "DOCX",
    region: "Pan-African",
  },
  {
    slug: "landlord-monthly-checklist",
    name: "Landlord Monthly Checklist",
    category: "Checklist",
    description: "Everything to check, log and reconcile every month.",
    downloads: 25,
    format: "DOCX",
    region: "Pan-African",
  },
  {
    slug: "csv-property-import",
    name: "Property CSV Import Template",
    category: "Receipt",
    description: "Empty CSV with the right columns for bulk property import.",
    downloads: 20,
    format: "CSV",
    region: "Pan-African",
  },
  {
    slug: "commercial-lease-kenya",
    name: "Kenya Commercial Lease (3-year)",
    category: "Lease",
    description: "Commercial lease template with CAM and escalation clauses.",
    downloads: 20,
    format: "DOCX",
    region: "Kenya",
  },
]

export type RoadmapStatus = "Now" | "Next" | "Later" | "Shipped"

export type RoadmapItem = {
  slug: string
  title: string
  description: string
  status: RoadmapStatus
  category: "Core" | "Payments" | "Tenant" | "Reporting" | "Platform"
  votes: number
}

export const roadmap: RoadmapItem[] = [
  { slug: "ai-rent-default-prediction", title: "AI rent-default prediction", description: "Surface tenants likely to default 30 days out, with suggested action.", status: "Now", category: "Reporting", votes: 412 },
  { slug: "owner-portal", title: "Owner portal", description: "Read-only portal for property owners to monitor their portfolio.", status: "Now", category: "Tenant", votes: 287 },
  { slug: "contractor-app", title: "Contractor mobile app", description: "Dedicated mobile experience for maintenance contractors.", status: "Next", category: "Core", votes: 198 },
  { slug: "recurring-expenses-ai", title: "AI recurring-expense detection", description: "Auto-suggest recurring expenses based on receipt patterns.", status: "Next", category: "Reporting", votes: 165 },
  { slug: "whatsapp-tenant-bot", title: "WhatsApp tenant bot", description: "Pay rent, raise maintenance and get receipts from WhatsApp.", status: "Next", category: "Tenant", votes: 340 },
  { slug: "smart-lease-templates", title: "Smart lease templates", description: "Generate a lease from a guided Q&A instead of filling a PDF.", status: "Later", category: "Core", votes: 122 },
  { slug: "rent-negotiation-tool", title: "Rent negotiation tool", description: "Suggest optimal rent increases based on market data.", status: "Later", category: "Reporting", votes: 87 },
  { slug: "investor-read-only", title: "Investor read-only role", description: "Granular investor access — see returns, not personal data.", status: "Later", category: "Platform", votes: 154 },
  { slug: "bulk-tenant-import", title: "Bulk tenant import", description: "Already shipped — import tenants from a CSV in one click.", status: "Shipped", category: "Core", votes: 0 },
  { slug: "tenant-statements", title: "Tenant statements", description: "Already shipped — annual statements for each tenant.", status: "Shipped", category: "Tenant", votes: 0 },
  { slug: "csv-import", title: "CSV import v2", description: "Already shipped — walk-through mapping and validation.", status: "Shipped", category: "Core", votes: 0 },
]

export type Customer = {
  slug: string
  name: string
  industry: string
  units: string
  location: string
  logo?: string
  summary: string
  challenge: string
  solution: string
  results: { label: string; value: string; detail?: string }[]
  quote: string
  quoteAuthor: string
  cover: string
}

export const customers: Customer[] = [
  {
    slug: "highland-estates",
    name: "Highland Estates",
    industry: "Multi-family residential",
    units: "212 units",
    location: "Eldoret, Kenya",
    summary: "A growing portfolio of mid-market family homes adopted PropDesk Africa to standardise reporting and replace four different spreadsheets.",
    challenge:
      "Reporting to investors was a manual two-day process every quarter. Maintenance requests were lost in WhatsApp threads. Late rent averaged 22%.",
    solution:
      "Standardised on PropDesk Africa's Pro plan, rolled out to all 212 units in three weeks, and connected the M-Pesa STK Push flow for every tenant.",
    results: [
      { label: "On-time collection", value: "78% → 96%", detail: "Within two quarters" },
      { label: "Hours/month saved", value: "32h", detail: "Reporting + maintenance routing" },
      { label: "First-year ROI", value: "5.4×" },
      { label: "Tenant NPS", value: "+24", detail: "Year over year" },
    ],
    quote:
      "PropDesk Africa is the first tool that made reporting something I look forward to sharing with my investors.",
    quoteAuthor: "Wanjiru M., Operations Director",
    cover: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1600&q=80",
  },
  {
    slug: "coast-living",
    name: "Coast Living",
    industry: "Short-stay + long-stay hybrid",
    units: "84 units",
    location: "Mombasa, Kenya",
    summary: "Coast Living operates beach apartments with mixed nightly and monthly tenants.",
    challenge:
      "Reconciling Airbnb, Booking.com and direct bookings across 84 units took a full-time accountant three days every month.",
    solution:
      "PropDesk Africa's flexible lease model and M-Pesa STK Push fit their cashflow cycle. Channel-manager sync on the roadmap.",
    results: [
      { label: "Tenant adoption", value: "92%", detail: "Of tenants on the portal" },
      { label: "Support tickets", value: "−41%" },
      { label: "M-Pesa fee savings", value: "KES 38k / mo" },
      { label: "Reconciliation time", value: "−85%" },
    ],
    quote: "Our tenants actually prefer paying through the portal — and so do we.",
    quoteAuthor: "Samuel O., Founder",
    cover: "https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=1600&q=80",
  },
  {
    slug: "kibera-housing-co",
    name: "Kibera Housing Co-op",
    industry: "Affordable housing co-operative",
    units: "245 units",
    location: "Nairobi, Kenya",
    summary: "A member-owned housing co-operative serving working families across six estates.",
    challenge:
      "Members needed transparent, auditable financial reporting — but the previous tool was opaque and Excel-based.",
    solution:
      "Read-only share links for the committee, monthly statements auto-sent to members, and a public-facing occupancy dashboard.",
    results: [
      { label: "Member trust", value: "+38 pts" },
      { label: "Audit prep time", value: "−75%" },
      { label: "Annual savings", value: "KES 1.2M" },
    ],
    quote: "Our members can finally see exactly where their rent goes. That's a level of trust we never had before.",
    quoteAuthor: "Fatma A., Co-op Secretary",
    cover: "https://images.unsplash.com/photo-1604014237800-1c9102c219da?auto=format&fit=crop&w=1600&q=80",
  },
]

export type Insight = {
  slug: string
  title: string
  excerpt: string
  readingMinutes: number
  publishedAt: string
  author: string
  cover: string
}

export const insights: Insight[] = [
  {
    slug: "future-of-rent-collection-africa",
    title: "The future of rent collection in Africa is mobile-first",
    excerpt: "Why US-built rent platforms keep failing in Africa — and what we learned building PropDesk Africa for it.",
    readingMinutes: 12,
    publishedAt: "2026-08-30",
    author: "Brian Kiarie",
    cover: "/propdesk-property-operations.png",
  },
  {
    slug: "landlord-economics-2026",
    title: "Landlord economics 2026: yield is down, complexity is up",
    excerpt: "An honest look at the numbers behind African residential yields and where smart landlords are focusing.",
    readingMinutes: 9,
    publishedAt: "2026-07-14",
    author: "Wanjiku Mwangi",
    cover: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1600&q=80",
  },
  {
    slug: "why-we-built-our-own-reconciliation",
    title: "Why we built our own reconciliation engine",
    excerpt: "How nightly reconciliation against Daraja's transaction log saves our landlords KES 38k/month on average.",
    readingMinutes: 7,
    publishedAt: "2026-06-02",
    author: "The PropDesk Africa team",
    cover: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=80",
  },
]

export type SubProcessor = {
  name: string
  purpose: string
  data: string
  region: string
  policy: string
}

export const subProcessors: SubProcessor[] = [
  { name: "Supabase", purpose: "PostgreSQL hosting", data: "All primary data", region: "EU (Frankfurt), KE (Nairobi)", policy: "supabase.com/legal" },
  { name: "Vercel", purpose: "Application hosting", data: "Edge function logs", region: "Global edge", policy: "vercel.com/legal/privacy" },
  { name: "Resend", purpose: "Transactional email", data: "Email addresses, body", region: "US", policy: "resend.com/legal/privacy-policy" },
  { name: "Safaricom Daraja", purpose: "M-Pesa processing", data: "Phone, amount, account #", region: "Kenya", policy: "safaricom.co.ke/privacy" },
  { name: "Airtel Money API", purpose: "Airtel Money processing", data: "Phone, amount", region: "Pan-Africa", policy: "airtel.africa/privacy" },
  { name: "Amazon Web Services", purpose: "Encrypted backups", data: "Database snapshots", region: "EU + KE", policy: "aws.amazon.com/privacy" },
  { name: "Cloudflare", purpose: "DDoS protection, WAF", data: "Request metadata", region: "Global edge", policy: "cloudflare.com/privacypolicy" },
  { name: "Sentry", purpose: "Error monitoring", data: "Stack traces", region: "EU + US", policy: "sentry.io/privacy" },
]

export type BrandAsset = {
  slug: string
  name: string
  description: string
  format: string
  size: string
  category: "Logo" | "Color" | "Typography" | "Photography"
}

export const brandAssets: BrandAsset[] = [
  { slug: "logo-light-svg", name: "Logo (light)", description: "Brand wordmark on a light background", format: "SVG", size: "12 KB", category: "Logo" },
  { slug: "logo-dark-svg", name: "Logo (dark)", description: "Brand wordmark on a dark background", format: "SVG", size: "12 KB", category: "Logo" },
  { slug: "logo-mark-svg", name: "Logo mark only", description: "Just the icon", format: "SVG", size: "8 KB", category: "Logo" },
  { slug: "logo-png", name: "Logo pack", description: "Light + dark PNGs at 4 sizes", format: "ZIP (PNG)", size: "320 KB", category: "Logo" },
  { slug: "color-palette", name: "Color palette", description: "OKLCH tokens for design systems", format: "JSON", size: "4 KB", category: "Color" },
  { slug: "brand-guidelines", name: "Brand guidelines", description: "Logo usage, typography, tone of voice", format: "DOCX", size: "1.8 MB", category: "Typography" },
  { slug: "product-screenshots", name: "Product screenshots", description: "Dashboard, portal, mobile app", format: "ZIP (PNG)", size: "12 MB", category: "Photography" },
  { slug: "founder-headshots", name: "Founder headshots", description: "Brian Kiarie press photos", format: "ZIP (JPG)", size: "3.4 MB", category: "Photography" },
]
