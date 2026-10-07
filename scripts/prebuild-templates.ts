/**
 * Pre-builds sample DOCX files for every template and writes them to
 * public/templates/preview/. The page at /dashboard/templates lists
 * downloadable .docx; this folder is the static fallback for users who
 * just want a blank copy without filling in fields.
 *
 * Run with: `npx tsx scripts/prebuild-templates.ts`
 * Or: `npm run templates:prebuild`
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs"
import { join } from "node:path"
import { listTemplates, renderTemplate } from "../lib/templates/templates"

const OUT_DIR = join(process.cwd(), "public", "templates", "preview")

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })

  const samples: Record<string, Record<string, string>> = {
    lease: {
      landlordName: "Acme Property Holdings Ltd",
      landlordAddress: "P.O. Box 1234, Nairobi",
      landlordId: "PVT-XYZ123456",
      tenantName: "Sample Tenant",
      tenantId: "12345678",
      tenantPhone: "0712 345 678",
      propertyName: "Kileleshwa Apartments — Unit 3B",
      propertyAddress: "Plot 12, Argwings Kodhek Road, Kileleshwa, Nairobi",
      leaseStart: "2026-01-01",
      leaseEnd: "2026-12-31",
      rentAmount: "35,000",
      deposit: "70,000",
    },
    receipt: {
      tenantName: "Sample Tenant",
      propertyAddress: "Kileleshwa Apartments — Unit 3B",
      periodCovered: "January 2026",
      amountPaid: "35,000",
      paymentMethod: "M-Pesa",
      reference: "QJG8K4XMPD",
    },
    "key-handover": {
      landlordName: "Acme Property Holdings Ltd",
      tenantName: "Sample Tenant",
      propertyAddress: "Kileleshwa Apartments — Unit 3B",
      handoverDate: "2026-01-01",
    },
    inspection: {
      tenantName: "Sample Tenant",
      propertyAddress: "Kileleshwa Apartments — Unit 3B",
      inspectionDate: "2026-01-01",
      inspectionType: "Move-in",
    },
    maintenance: {
      tenantName: "Sample Tenant",
      tenantPhone: "0712 345 678",
      propertyAddress: "Kileleshwa Apartments — Unit 3B",
      category: "plumbing",
      priority: "medium",
      description: "The kitchen tap drips constantly. Started 2 days ago. Water pools under the sink.",
      preferredTime: "Weekday mornings",
      requestDate: "2026-01-15",
    },
    termination: {
      tenantName: "Sample Tenant",
      propertyAddress: "Kileleshwa Apartments — Unit 3B",
      leaseStart: "2025-01-01",
      terminationDate: "2026-02-28",
      reason: "End of contract term",
    },
    "rent-increase": {
      tenantName: "Sample Tenant",
      propertyAddress: "Kileleshwa Apartments — Unit 3B",
      currentRent: "35,000",
      newRent: "38,000",
      effectiveDate: "2026-04-01",
    },
    complaint: {
      tenantName: "Sample Tenant",
      tenantPhone: "0712 345 678",
      propertyAddress: "Kileleshwa Apartments — Unit 3B",
      description: "Loud music from the unit above after 11pm on multiple occasions.",
      incidentDate: "2026-01-20",
    },
    checklist: {
      landlordName: "Acme Property Holdings Ltd",
    },
    "expense-log": {
      propertyAddress: "Kileleshwa Apartments — Unit 3B",
      periodCovered: "January 2026",
    },
  }

  for (const meta of listTemplates()) {
    try {
      const fields = samples[meta.id] || {}
      const buf = await renderTemplate(meta.id, fields)
      const file = join(OUT_DIR, `${meta.id}.docx`)
      writeFileSync(file, buf)
      console.log(`✓ ${meta.id}.docx (${buf.byteLength} bytes)`)
    } catch (e: any) {
      console.error(`✗ ${meta.id}: ${e.message}`)
    }
  }
  console.log(`\nWrote sample DOCX files to ${OUT_DIR}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})