import { blogPosts } from "@/lib/content/blog"

const SITE = "https://i-manage.app"
const FEED_TITLE = "I-Manage by Siemax Ltd — Resources"
const FEED_DESCRIPTION = "Practical property management guides, product updates and operating notes for landlords across Africa."

function escape(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

export const dynamic = "force-static"

export async function GET() {
  const items = blogPosts
    .map((p) => {
      const url = `${SITE}/resources/${p.slug}`
      return `<item>
        <title>${escape(p.title)}</title>
        <link>${url}</link>
        <guid>${url}</guid>
        <pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate>
        <category>${escape(p.category)}</category>
        <author>${escape(p.author.name)}</author>
        <description>${escape(p.excerpt)}</description>
      </item>`
    })
    .join("\n")

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(FEED_TITLE)}</title>
    <link>${SITE}/resources</link>
    <atom:link href="${SITE}/rss.xml" rel="self" type="application/rss+xml" />
    <description>${escape(FEED_DESCRIPTION)}</description>
    <language>en-GB</language>
    <copyright>© ${new Date().getUTCFullYear()} Siemax Ltd</copyright>
    <ttl>60</ttl>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  })
}
