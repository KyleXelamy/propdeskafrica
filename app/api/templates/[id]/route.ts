import { errorResponse, successResponse, HttpError } from "@/lib/api"
import { getTemplate } from "@/lib/templates/templates"

/**
 * GET /api/templates/[id]
 * Returns metadata for a single template (its fields, description, etc).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const meta = getTemplate(id)
  if (!meta) throw new HttpError("Unknown template", 404)
  return successResponse(meta)
}