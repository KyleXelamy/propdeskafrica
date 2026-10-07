import type React from "react"
import type { Metadata, Viewport } from "next"
import { ThemeProvider } from "@/components/theme-provider"
import { CookieConsent } from "@/components/cookie-consent"
import "./globals.css"

const siteUrl = "https://i-manage.app"

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
    default: "I-Manage — Property operations",
    template: "%s | I-Manage",
  },
  description:
    "I-Manage — the operating system for landlords and property agencies. Track properties, tenants, rent, expenses, maintenance, quotations and documents in one place.",
  applicationName: "I-Manage",
  authors: [{ name: "Brian Kiarie", url: "https://www.linkedin.com/in/brian-kiarie-00b3a3391" }],
  creator: "Brian Kiarie",
  publisher: "I-Manage",
  keywords: [
    "property management software",
    "rental management software",
    "landlord software",
    "property management Kenya",
    "rent collection software",
    "I-Manage",
  ],
  generator: "Next.js",
  openGraph: {
    type: "website",
    url: siteUrl,
    title: "I-Manage — modern property management",
    description:
      "Run your rental portfolio with clarity. M-Pesa paybill + STK Push rent collection, tenant records, quotations, maintenance workflows and live financial reports.",
    siteName: "I-Manage",
    locale: "en_US",
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "I-Manage — Property operations" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "I-Manage — modern property management",
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
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: "/apple-icon.png",
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
              name: "I-Manage",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              url: siteUrl,
              description: "Property operations software for landlords and property teams.",
              publisher: { "@type": "Organization", name: "I-Manage", url: siteUrl },
            }),
          }}
        />
      </body>
    </html>
  )
}
