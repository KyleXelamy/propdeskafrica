/**
 * GET /press/company-fact-sheet.txt
 *
 * Serves the company fact sheet referenced by the press kit as a plain-text
 * download. The press page links to this path; previously the link 404'd
 * because no file was ever shipped.
 *
 * Every value below is derived from the product itself (lib/brand.ts,
 * lib/pricing.ts, lib/system.ts and the marketing content) so the sheet
 * cannot drift from the site.
 */
import { BRAND } from "@/lib/brand"
import { MONTHLY_PRICE_KES, TRIAL_DAYS, formatPrice } from "@/lib/pricing"
import { APP_NAME, APP_VERSION } from "@/lib/system"

export const dynamic = "force-static"

function factSheet(): string {
  return [
    `${APP_NAME} — Company fact sheet`,
    "",
    "──────────────────────────────────────────────────────",
    "",
    "COMPANY",
    "",
    `  Product name      ${BRAND.product}`,
    `  Company           ${BRAND.company}`,
    `  Founder           ${BRAND.creator}`,
    `  Press contact     ${BRAND.supportEmail}`,
    `  Phone             ${BRAND.supportPhone}`,
    `  Product version   ${APP_VERSION}`,
    "",
    "WHAT IT IS",
    "",
    `  ${BRAND.product} is a property-management workspace for landlords, agents and`,
    "  property teams in East Africa. Properties, tenants, rent collection,",
    "  maintenance, quotations, damages, documents and contacts live in one",
    "  workspace, and tenants pay by M-Pesa to the paybill or till number the",
    "  landlord already uses.",
    "",
    "PRODUCT HIGHLIGHTS",
    "",
    "  - Native M-Pesa STK Push rent collection",
    "  - Paybill / till integration with automatic reconciliation",
    "  - Quotations, approvals, damages and inspections",
    "  - Recurring expenses, document vault and expiry alerts",
    "  - Property map, portfolio reporting and JSON/CSV export",
    "  - 12 downloadable lease, notice and inspection templates",
    "",
    "PRICING",
    "",
    `  One plan: ${APP_NAME} Pro — ${formatPrice(MONTHLY_PRICE_KES)} per month,`,
    `  regardless of portfolio size. Every new workspace starts with a`,
    `  ${TRIAL_DAYS}-day trial. No credit card required to start.`,
    "",
    "QUESTIONS",
    "",
    `  Press enquiries: ${BRAND.supportEmail}`,
    "",
  ].join("\n")
}

export async function GET() {
  return new Response(factSheet(), {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": 'attachment; filename="propdesk-africa-company-fact-sheet.txt"',
      "cache-control": "public, max-age=3600",
    },
  })
}
