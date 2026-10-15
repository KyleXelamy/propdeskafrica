import type React from "react"
import type { Metadata, Viewport } from "next"
import { ThemeProvider } from "@/components/theme-provider"
import { CookieConsent } from "@/components/cookie-consent"
import "./globals.css"

const siteUrl = "https://propdeskafrica.com"

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f3ed" },
    { media: "(prefers-color-scheme: dark)", color: "#15231d" },
  ],
  width: "device-width",
  initialScale: 1,
}

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "PropDesk Africa — Property operations",
    template: "%s | PropDesk Africa",
  },
  description:
    "PropDesk Africa — the operating system for landlords and property agencies. Track properties, tenants, rent, expenses, maintenance, quotations and documents in one place.",
  applicationName: "PropDesk Africa",
  authors: [{ name: "Brian Kiarie", url: "https://www.linkedin.com/in/brian-kiarie-00b3a3391" }],
  creator: "Brian Kiarie",
  publisher: "PropDesk Africa",
  keywords: [
    "property management software",
    "rental management software",
    "landlord software",
    "property management Kenya",
    "rent collection software",
    "PropDesk Africa",
  ],
  generator: "Next.js",
  openGraph: {
    type: "website",
    url: siteUrl,
    title: "PropDesk Africa — modern property management",
    description:
      "Run your rental portfolio with clarity. M-Pesa paybill + STK Push rent collection, tenant records, quotations, maintenance workflows and live financial reports.",
    siteName: "PropDesk Africa",
    locale: "en_US",
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "PropDesk Africa — Property operations" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "PropDesk Africa — modern property management",
    description:
      "Run your rental portfolio with clarity. M-Pesa paybill + STK Push rent collection, tenant records, quotations, maintenance workflows and live financial reports.",
    images: ["/og-default.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  alternates: {
    canonical: siteUrl,
    types: {
      "application/rss+xml": `${siteUrl}/rss.xml`,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <body className="font-sans">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <CookieConsent />
        </ThemeProvider>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "PropDesk Africa",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              url: siteUrl,
              description: "Property operations software for landlords and property teams.",
              publisher: { "@type": "Organization", name: "PropDesk Africa", url: siteUrl },
            }),
          }}
        />
      </body>
    </html>
  )
}
