import { successResponse } from "@/lib/api"
import { listTemplates } from "@/lib/templates/templates"

/**
 * GET /api/templates
 * Public list of all available templates. Each entry includes the input
 * fields so the UI can build a form for them.
 */
export async function GET() {
  return successResponse(listTemplates())
}