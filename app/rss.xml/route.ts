import { blogPosts } from "@/lib/content/blog"

const SITE = "https://propdeskafrica.com"
const FEED_TITLE = "PropDesk Africa — Resources"
const FEED_DESCRIPTION = "Practical property management guides, product updates and operating notes for landlords across Africa."

function escape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function safeDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? new Date(0) : date
}

export const dynamic = "force-static"

export async function GET() {
  const items = blogPosts
    .filter((post) => post.slug && post.title && post.excerpt)
    .map((post) => {
      const url = `${SITE}/resources/${encodeURIComponent(post.slug)}`
      const author = post.author?.name || "PropDesk Africa"
      return `<item>
        <title>${escape(post.title)}</title>
        <link>${url}</link>
        <guid isPermaLink="true">${url}</guid>
        <pubDate>${safeDate(post.publishedAt).toUTCString()}</pubDate>
        <category>${escape(post.category || "Resources")}</category>
        <dc:creator>${escape(author)}</dc:creator>
        <description>${escape(post.excerpt)}</description>
      </item>`
    })
    .join("\n")

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escape(FEED_TITLE)}</title>
    <link>${SITE}/resources</link>
    <atom:link href="${SITE}/rss.xml" rel="self" type="application/rss+xml" />
    <description>${escape(FEED_DESCRIPTION)}</description>
    <language>en-GB</language>
    <copyright>© ${new Date().getUTCFullYear()} PropDesk Africa</copyright>
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
