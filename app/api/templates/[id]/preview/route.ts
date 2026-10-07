import { errorResponse, successResponse } from "@/lib/api"
import { getTemplate } from "@/lib/templates/templates"
import type { DocxTemplateInput } from "@/lib/templates/types"

/**
 * POST /api/templates/[id]/preview
 * Body: { fields: DocxTemplateInput }
 *
 * Returns a JSON rendering of the template with the user's field values,
 * so the UI can show a live preview without downloading the .docx.
 * The preview is intentionally simplified — the .docx is the canonical
 * output; this is just a quick "what will this look like" view.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const meta = getTemplate(id)
  if (!meta) return errorResponse("Unknown template", 404)

  const body = await req.json().catch(() => ({})) as any
  const f: DocxTemplateInput = body?.fields || {}

  // Very small renderer — returns structured sections for the preview pane.
  const sections: { heading: string; lines: string[] }[] = []
  const add = (heading: string, lines: (string | { label: string; value: string })[]) => {
    sections.push({ heading, lines: lines.map((l) => typeof l === "string" ? l : `${l.label}: ${l.value || "—"}`) })
  }

  switch (id) {
    case "lease":
      add("Parties", [
        { label: "Landlord", value: f.landlordName },
        { label: "Tenant", value: f.tenantName },
        { label: "Property", value: f.propertyAddress },
      ])
      add("Term", [
        { label: "Start", value: f.leaseStart },
        { label: "End", value: f.leaseEnd },
      ])
      add("Money", [
        { label: "Monthly rent", value: f.rentAmount ? `KES ${f.rentAmount}` : "" },
        { label: "Deposit", value: f.deposit ? `KES ${f.deposit}` : "" },
      ])
      break
    case "receipt":
      add("Receipt", [
        { label: "Tenant", value: f.tenantName },
        { label: "Property", value: f.propertyAddress },
        { label: "Period", value: f.periodCovered },
        { label: "Amount", value: f.amountPaid ? `KES ${f.amountPaid}` : "" },
        { label: "Method", value: f.paymentMethod },
        { label: "Reference", value: f.reference },
      ])
      break
    case "maintenance":
      add("Request", [
        { label: "Tenant", value: f.tenantName },
        { label: "Property", value: f.propertyAddress },
        { label: "Category", value: f.category },
        { label: "Priority", value: f.priority },
        { label: "Description", value: f.description },
        { label: "Preferred time", value: f.preferredTime },
      ])
      break
    default:
      Object.entries(f).forEach(([k, v]) => {
        add(k, [{ label: k, value: String(v ?? "") }])
      })
  }

  return successResponse({ template: meta, sections })
}