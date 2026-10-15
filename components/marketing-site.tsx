'use client'

import Link from "next/link"
import { ArrowUpRight, BarChart3, Building2, Check, ChevronRight, CircleDollarSign, Menu, ShieldCheck, Smartphone, Sparkles, X } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { BrandWordmark } from "@/components/brand-mark"
import { MegaMenu, type MegaSection } from "@/components/mega-menu"
import { BRAND } from "@/lib/brand"

const navSections: MegaSection[] = [
  {
    label: "Product",
    href: "/features",
    groups: [
      {
        heading: "Core",
        items: [
          { label: "Rent collection", href: "/features/rent-collection", description: "M-Pesa STK Push, retries, reconciliation." },
          { label: "Tenant records", href: "/features/tenant-records", description: "Every tenant. Every contact. Every lease." },
          { label: "Paybill", href: "/features/paybill-integration", description: "Tenants pay your paybill, you see it." },
          { label: "Maintenance", href: "/features/maintenance", description: "Request → quote → invoice → done." },
          { label: "Documents", href: "/features/documents", description: "Encrypted vault with expiry alerts." },
        ],
      },
      {
        heading: "Insight",
        items: [
          { label: "Reports & exports", href: "/features/reports", description: "Cashflow, arrears, occupancy, yield." },
          { label: "Expenses & receipts", href: "/features/expenses", description: "Snap, recur, forget." },
          { label: "Multi-property", href: "/features/multi-property", description: "Mixed-use portfolios in one workspace." },
          { label: "Developer API", href: "/features/developer-api", description: "REST, webhooks, OpenAPI spec." },
        ],
      },
    ],
    featured: {
      eyebrow: "New",
      title: "AI rent-default prediction",
      body: "Surface tenants likely to default 30 days out, with suggested action.",
      href: "/changelog",
      cta: "Read the changelog",
    },
  },
  {
    label: "Solutions",
    href: "/solutions",
    groups: [
      {
        heading: "By size",
        items: [
          { label: "Solo landlord", href: "/solutions/solo-landlord", description: "From one unit to ten." },
          { label: "Property agencies", href: "/solutions/property-agencies", description: "Multi-landlord, multi-team." },
          { label: "Commercial", href: "/solutions/commercial", description: "Office, retail, industrial." },
          { label: "Vacation rental", href: "/solutions/vacation-rental", description: "Nightly + monthly hybrid." },
        ],
      },
      {
        heading: "By role",
        items: [
          { label: "Developers", href: "/solutions/developer", description: "Build on the PropDesk Africa API." },
          { label: "Enterprise", href: "/solutions/enterprise", description: "SOC-aligned, procurement-ready." },
          { label: "Pricing", href: "/pricing", description: "Honest plans, no surprises." },
          { label: "Compare", href: "/compare", description: "How we stack up." },
        ],
      },
    ],
  },
  {
    label: "Resources",
    href: "/resources",
    groups: [
      {
        heading: "Learn",
        items: [
          { label: "Articles", href: "/resources", description: "Field notes from the team." },
          { label: "Insights", href: "/insights", description: "Longer reads & analysis." },
          { label: "Changelog", href: "/changelog", description: "Every release, in public." },
          { label: "Customer stories", href: "/customers", description: "Case studies and testimonials." },
        ],
      },
      {
        heading: "Build",
        items: [
          { label: "Docs", href: "/docs", description: "Guides and API reference." },
          { label: "Templates", href: "/templates", description: "Leases, checklists, receipts." },
          { label: "Roadmap", href: "/roadmap", description: "What we're shipping next." },
          { label: "Brand kit", href: "/brand", description: "Logos, colors, press kit." },
        ],
      },
    ],
  },
  {
    label: "Company",
    href: "/about",
    groups: [
      {
        heading: "About",
        items: [
          { label: "About PropDesk Africa", href: "/about", description: "Our mission and values." },
          { label: "Careers", href: "/careers", description: "Open roles across the team." },
          { label: "Press", href: "/press", description: "Press kit & coverage." },
          { label: "Contact", href: "/contact", description: "Talk to the team." },
        ],
      },
      {
        heading: "Trust",
        items: [
          { label: "Security", href: "/security", description: "How we protect your data." },
          { label: "Status", href: "/status", description: "Real-time operational status." },
          { label: "DPA", href: "/legal/dpa", description: "GDPR-aligned data processing." },
          { label: "Sub-processors", href: "/sub-processors", description: "Who we work with." },
        ],
      },
    ],
  },
  { label: "Pricing", href: "/pricing" },
]

export function MarketingHeader() {
  const [open, setOpen] = useState(false)
  return (
    <header className="sticky top-0 z-40 bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-[1320px] items-center justify-between px-5 py-4 lg:px-10">
        <BrandWordmark href="/" showSubtitle={false} size="lg" className="text-primary-foreground" />
        <MegaMenu sections={navSections} className="ml-8" />
        <div className="hidden items-center gap-2 lg:flex">
          <Button variant="ghost" asChild className="rounded-full text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
            <Link href="/auth/login">Sign in</Link>
          </Button>
          <Button asChild className="rounded-full bg-accent px-5 text-primary hover:bg-accent/90">
            <Link href="/auth/sign-up">Get started <ArrowUpRight data-icon="inline-end" /></Link>
          </Button>
        </div>
        <button type="button" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen(!open)} className="rounded-full p-2 text-primary-foreground lg:hidden">
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <div className="border-t border-primary-foreground/10 bg-primary px-5 py-6 lg:hidden">
          <div className="flex flex-col gap-1">
            {navSections.map((section) => (
              <Link
                key={section.label}
                href={section.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-sm font-medium text-primary-foreground/80 hover:bg-primary-foreground/5"
              >
                {section.label}
              </Link>
            ))}
            <Link
              href="/auth/login"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-3 text-sm font-medium text-primary-foreground/80 hover:bg-primary-foreground/5"
            >
              Sign in
            </Link>
            <Button asChild className="mt-3 rounded-full bg-accent text-primary hover:bg-accent/90">
              <Link href="/auth/sign-up">Get started</Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  )
}

export function MarketingFooter() {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="mx-auto grid max-w-[1320px] gap-12 px-5 py-16 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr] lg:px-10">
        <div>
          <BrandWordmark href="/" showSubtitle={false} size="lg" className="text-primary-foreground" />
          <p className="mt-6 max-w-xs text-sm leading-6 text-primary-foreground/55">
            The operating system for ambitious landlords and property teams across Africa.
          </p>
        </div>
        <div>
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-accent">Platform</p>
          <div className="flex flex-col gap-3 text-sm text-primary-foreground/65">
            <Link href="/">Overview</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/customers">Customers</Link>
            <Link href="/integrations">Integrations</Link>
            <Link href="/app">Landlord app</Link>
            <Link href="/changelog">Changelog</Link>
          </div>
        </div>
        <div>
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-accent">Company</p>
          <div className="flex flex-col gap-3 text-sm text-primary-foreground/65">
            <Link href="/about">About</Link>
            <Link href="/careers">Careers</Link>
            <Link href="/press">Press</Link>
            <Link href="/security">Security</Link>
            <Link href="/contact">Contact</Link>
            <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>
            <a href={BRAND.supportPhoneHref}>{BRAND.supportPhone}</a>
          </div>
        </div>
        <div>
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-accent">Resources</p>
          <div className="flex flex-col gap-3 text-sm text-primary-foreground/65">
            <Link href="/resources">Articles</Link>
            <Link href="/help">Help & FAQ</Link>
            <Link href="/status">Status</Link>
            <Link href="/rss.xml">RSS feed</Link>
          </div>
        </div>
        <div>
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-accent">Legal</p>
          <div className="flex flex-col gap-3 text-sm text-primary-foreground/65">
            <Link href="/legal/privacy">Privacy</Link>
            <Link href="/legal/terms">Terms</Link>
            <Link href="/legal/dpa">DPA</Link>
            <Link href="/auth/login">Sign in</Link>
            <Link href="/auth/sign-up">Get started</Link>
          </div>
        </div>
      </div>
      <div className="mx-auto flex max-w-[1320px] flex-col gap-3 border-t border-primary-foreground/10 px-5 py-6 text-xs text-primary-foreground/40 sm:flex-row sm:justify-between lg:px-10">
        <span>© {new Date().getFullYear()} PropDesk Africa. All rights reserved.</span>
        <span>Built for property owners who think bigger.</span>
      </div>
    </footer>
  )
}

const features = [
  { icon: Building2, eyebrow: "Portfolio command", title: "Every property. One clear view.", body: "Move from scattered spreadsheets to a live operating picture of your entire portfolio." },
  { icon: CircleDollarSign, eyebrow: "Cashflow intelligence", title: "Know what is happening with your money.", body: "Track rent, expenses, arrears and performance without waiting for month-end." },
  { icon: ShieldCheck, eyebrow: "Operational control", title: "Run the day-to-day with confidence.", body: "Keep leases, documents, maintenance and team activity connected and accountable." },
]

export function MarketingHome() {
  return <main>
    <section className="relative min-h-[720px] overflow-hidden bg-[#15231d] text-white"><div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(21,35,29,.98)_12%,rgba(21,35,29,.72)_52%,rgba(21,35,29,.18)),url('https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=2200&q=85')] bg-cover bg-center" /><MarketingHeader /><div className="relative mx-auto flex min-h-[720px] max-w-[1320px] items-end px-5 pb-20 pt-36 lg:px-10 lg:pb-28"><div className="max-w-3xl"><p className="mb-7 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#d9f45b]"><span className="h-px w-10 bg-[#d9f45b]" />Property operations, elevated</p><h1 className="max-w-4xl text-5xl font-medium leading-[.98] tracking-[-0.055em] sm:text-7xl lg:text-[92px]">Property management with <em className="font-serif font-normal text-[#d9f45b]">ambition.</em></h1><p className="mt-8 max-w-xl text-base leading-7 text-white/70 sm:text-lg">PropDesk Africa gives landlords and property teams the clarity to grow a better portfolio, protect their returns and deliver a better standard of living.</p><div className="mt-9 flex flex-col gap-3 sm:flex-row"><Button asChild size="lg" className="rounded-full bg-[#d9f45b] px-7 text-[#15231d] hover:bg-[#e5ff75]"><Link href="/auth/sign-up">Build your portfolio <ArrowUpRight data-icon="inline-end" /></Link></Button><Button asChild size="lg" variant="outline" className="rounded-full border-white/30 bg-transparent px-7 text-white hover:bg-white/10 hover:text-white"><Link href="#platform">Explore the platform <ChevronRight data-icon="inline-end" /></Link></Button></div></div></div></section>
    <section id="platform" className="bg-[#f4f3ed] px-5 py-24 text-[#15231d] lg:px-10 lg:py-36"><div className="mx-auto max-w-[1320px]"><div className="grid gap-12 lg:grid-cols-[.85fr_1.15fr] lg:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#738171]">One operating system</p><h2 className="mt-5 max-w-xl text-4xl font-medium leading-tight tracking-[-0.04em] sm:text-6xl">The calm behind a well-run portfolio.</h2></div><p className="max-w-md text-base leading-7 text-[#5d6a5f]">From your first unit to your next hundred, PropDesk Africa brings the financial, operational and human sides of property into one thoughtful workspace.</p></div><div className="mt-20 grid gap-px overflow-hidden rounded-3xl bg-[#cad1c7] md:grid-cols-3">{features.map(({ icon: Icon, eyebrow, title, body }, i) => <article key={title} className="bg-[#f4f3ed] p-8 lg:p-10"><div className="flex items-center justify-between"><Icon className="size-8 text-[#45604d]" strokeWidth={1.5} /><span className="text-xs text-[#9aa59b]">0{i + 1}</span></div><p className="mt-16 text-xs font-semibold uppercase tracking-[0.18em] text-[#738171]">{eyebrow}</p><h3 className="mt-4 text-2xl font-medium leading-tight tracking-[-0.03em]">{title}</h3><p className="mt-4 text-sm leading-6 text-[#5d6a5f]">{body}</p></article>)}</div></div></section>
    <section id="landlords" className="bg-[#d9f45b] px-5 py-24 text-[#15231d] lg:px-10 lg:py-32"><div className="mx-auto grid max-w-[1320px] gap-12 lg:grid-cols-[1fr_.8fr] lg:items-center"><div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#45604d]">Designed for the decision makers</p><h2 className="mt-5 max-w-2xl text-4xl font-medium leading-tight tracking-[-0.05em] sm:text-6xl">Your portfolio is a business. Run it like one.</h2><p className="mt-7 max-w-xl text-lg leading-8 text-[#40523f]">PropDesk Africa is intentionally built for landlords and their agents. Tenants get the service they need; you get the control, context and momentum to make better decisions.</p><div className="mt-9 grid gap-4 sm:grid-cols-2">{["Live portfolio reporting", "M-Pesa rent collection", "Maintenance workflows", "Secure document control"].map((item) => <div key={item} className="flex items-center gap-3 text-sm font-medium"><span className="grid size-6 place-items-center rounded-full bg-[#15231d] text-[#d9f45b]"><Check className="size-3" /></span>{item}</div>)}</div></div><div className="rounded-3xl bg-[#15231d] p-7 text-white shadow-2xl lg:rotate-2 lg:p-10"><div className="flex items-center justify-between border-b border-white/10 pb-6"><div><p className="text-xs uppercase tracking-[0.2em] text-white/50">Portfolio overview</p><p className="mt-2 text-2xl font-medium">October, 2026</p></div><BarChart3 className="text-[#d9f45b]" /></div><div className="mt-8 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-white/10 p-5"><p className="text-xs text-white/50">Portfolio value</p><p className="mt-3 text-2xl">KES 48.2M</p><p className="mt-2 text-xs text-[#d9f45b]">↑ 12.4% this year</p></div><div className="rounded-2xl bg-white/10 p-5"><p className="text-xs text-white/50">Collected this month</p><p className="mt-3 text-2xl">KES 3.84M</p><p className="mt-2 text-xs text-[#d9f45b]">94.8% collected</p></div></div><div className="mt-4 rounded-2xl bg-white/10 p-5"><div className="flex items-end gap-2"><span className="h-10 flex-1 rounded-t bg-[#708a68]" /><span className="h-16 flex-1 rounded-t bg-[#8eaa80]" /><span className="h-14 flex-1 rounded-t bg-[#9fba8e]" /><span className="h-24 flex-1 rounded-t bg-[#d9f45b]" /><span className="h-20 flex-1 rounded-t bg-[#b6d449]" /><span className="h-28 flex-1 rounded-t bg-[#d9f45b]" /><span className="h-24 flex-1 rounded-t bg-[#b6d449]" /></div><div className="mt-4 flex justify-between text-[10px] text-white/40"><span>APR</span><span>OCT</span></div></div></div></div></section>
    <section className="bg-[#f4f3ed] px-5 py-24 lg:px-10 lg:py-32"><div className="mx-auto max-w-[1320px] text-center"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#738171]">Ready when you are</p><h2 className="mx-auto mt-5 max-w-3xl text-4xl font-medium leading-tight tracking-[-0.05em] sm:text-6xl">A better way to own what comes next.</h2><p className="mx-auto mt-6 max-w-lg text-base leading-7 text-[#5d6a5f]">Start with a clearer view of today, then build the portfolio you want tomorrow.</p><div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row"><Button asChild size="lg" className="rounded-full bg-[#15231d] px-7 text-white hover:bg-[#263b30]"><Link href="/auth/sign-up">Start managing <ArrowUpRight data-icon="inline-end" /></Link></Button><Button asChild size="lg" variant="outline" className="rounded-full border-[#15231d]/20 px-7"><Link href="/contact">Talk to our team</Link></Button></div></div></section>
    <MarketingFooter />
  </main>
}

export function SimpleMarketingPage({ title, intro, sectionTitle, sectionBody }: { title: string; intro: string; sectionTitle: string; sectionBody: string }) {
  return <main className="min-h-screen bg-[#f4f3ed] text-[#15231d]"><div className="bg-[#15231d] text-white"><MarketingHeader /><div className="mx-auto max-w-[1320px] px-5 pb-24 pt-44 lg:px-10"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d9f45b]">PropDesk Africa</p><h1 className="mt-6 max-w-4xl text-5xl font-medium leading-none tracking-[-0.055em] sm:text-7xl">{title}</h1><p className="mt-8 max-w-xl text-lg leading-8 text-white/65">{intro}</p></div></div><section className="mx-auto grid max-w-[1320px] gap-12 px-5 py-24 lg:grid-cols-2 lg:px-10 lg:py-36"><div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#738171]">The bigger picture</p><h2 className="mt-5 text-4xl font-medium leading-tight tracking-[-0.04em]">{sectionTitle}</h2></div><p className="text-lg leading-8 text-[#5d6a5f]">{sectionBody}</p></section><MarketingFooter /></main>
}

export function InstallCard() { return <div className="mt-10 flex items-center gap-4 rounded-2xl border border-white/15 bg-white/10 p-4"><div className="grid size-12 place-items-center rounded-xl bg-[#d9f45b] text-[#15231d]"><Smartphone className="size-5" /></div><div><p className="text-sm font-medium">Take PropDesk Africa with you</p><p className="text-xs text-white/55">Install the landlord app from your browser.</p></div><Sparkles className="ml-auto size-4 text-[#d9f45b]" /></div> }
