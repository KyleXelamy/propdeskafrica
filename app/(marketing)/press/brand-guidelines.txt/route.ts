/**
 * GET /press/brand-guidelines.txt
 *
 * Serves the brand guidelines referenced by the press kit as a plain-text
 * download. The press page links to this path; previously the link 404'd
 * because no file was ever shipped.
 *
 * Every value below is taken from the product itself (app/(marketing)/brand
 * page, lib/brand.ts) so the document cannot drift from the site.
 */
import { BRAND } from "@/lib/brand"

const COLORS: Array<{ name: string; hex: string }> = [
  { name: "Brand ink", hex: "#15231d" },
  { name: "Brand lime", hex: "#d9f45b" },
  { name: "Brand cream", hex: "#f4f3ed" },
  { name: "Sage deep", hex: "#45604d" },
  { name: "Sage", hex: "#5d6a5f" },
  { name: "Sage mist", hex: "#9aa59b" },
]

export const dynamic = "force-static"

function guidelines(): string {
  const colorBlock = COLORS.map((c) => `  ${c.name.padEnd(14)} ${c.hex}`).join("\n")

  return [
    `${BRAND.product} — Brand guidelines`,
    "",
    "----------------------------------------------------",
    "",
    "1. THE MARK",
    "",
    `The wordmark reads "${BRAND.product}". Use the supplied files as-is:`,
    "  /icon.svg                   Vector mark (SVG)",
    "  /icon-light-32x32.png      32 x 32 PNG, light background",
    "  /icon-dark-32x32.png       32 x 32 PNG, dark background",
    "  /propdesk-africa-logo.png  Full-resolution logo",
    "",
    "Please do not stretch, re-colour, outline, or re-space the mark. Clear space",
    "around the mark should be at least the height of the wordmark's cap height.",
    "",
    "2. COLOUR",
    "",
    colorBlock,
    "",
    "Brand ink is the primary text and surface colour. Brand lime is the accent",
    "and must not be used for body copy on a light background.",
    "",
    "3. TYPOGRAPHY",
    "",
    "Headlines are set in a tight, medium-weight sans serif. Body copy is set in",
    "the same family at a regular weight with generous line height. The wordmark",
    "itself is not to be re-typeset.",
    "",
    "4. TONE OF VOICE",
    "",
    "Plain, specific, unhurried. Say what the product does before saying what it",
    "feels like. Avoid superlatives and avoid invented metrics.",
    "",
    "5. USE",
    "",
    "These guidelines cover editorial and partner use. For co-marketing, reseller",
    "or campaign assets, contact the team first.",
    "",
    "Questions: " + BRAND.supportEmail,
    "",
  ].join("\n")
}

export async function GET() {
  return new Response(guidelines(), {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": 'attachment; filename="propdesk-africa-brand-guidelines.txt"',
      "cache-control": "public, max-age=3600",
    },
  })
}
