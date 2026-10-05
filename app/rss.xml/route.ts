import { blogPosts } from "@/lib/content/blog"

const SITE = "https://i-manage.app"

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
<rss version="2.0">
  <channel>
    <title>I-Manage — Resources</title>
    <link>${SITE}/resources</link>
    <description>Field notes, product updates and practical guides for ambitious landlords.</description>
    <language>en-us</language>
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