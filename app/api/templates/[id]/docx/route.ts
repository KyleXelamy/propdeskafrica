import { errorResponse, HttpError, successResponse } from "@/lib/api"
import { getTemplate, renderTemplate } from "@/lib/templates/templates"
import type { DocxTemplateInput } from "@/lib/templates/types"

/**
 * POST /api/templates/[id]/docx
 * Body: { fields: { ...DocxTemplateInput } }
 *
 * Generates a .docx file for the named template with the provided field
 * values and returns it as a downloadable attachment.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const meta = getTemplate(id)
  if (!meta) throw new HttpError("Unknown template", 404)

  let body: any = {}
  try { body = await req.json() } catch {}
  const input: DocxTemplateInput = body?.fields || {}

  try {
    const buf = await renderTemplate(id, input)
    // Convert Node Buffer to a Uint8Array (Web Response compatible)
    const bytes = new Uint8Array(buf)
    return new Response(bytes, {
      status: 200,
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "content-disposition": `attachment; filename="${id}-${new Date().toISOString().slice(0, 10)}.docx"`,
        "content-length": String(bytes.byteLength),
        "cache-control": "no-store",
      },
    })
  } catch (e: any) {
    return errorResponse(e?.message || "Render failed", 500)
  }
}

/**
 * GET /api/templates/[id]/docx
 * Returns the template's metadata + default field values for the form.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const meta = getTemplate(id)
  if (!meta) throw new HttpError("Unknown template", 404)
  return successResponse(meta)
}