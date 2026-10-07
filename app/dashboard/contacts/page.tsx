"use client"

import { useEffect, useMemo, useState } from "react"
import { Search, UserRound } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"

type Contact = { id: string; name: string; role: string; email: string | null; phone: string | null; company: string | null; source: "contact" | "tenant" | "emergency" }

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const supabase = createClient()
    Promise.all([
      supabase.from("contacts").select("id, name, role, email, phone, company"),
      supabase.from("tenants").select("id, full_name, first_name, last_name, email, phone, emergency_contact_name, emergency_contact_phone, company"),
    ]).then(([contactsResult, tenantsResult]) => {
      if (!active) return
      if (contactsResult.error) {
        setError(contactsResult.error.message)
        setLoading(false)
        return
      }
      if (tenantsResult.error) {
        setError(tenantsResult.error.message)
        setLoading(false)
        return
      }

      const savedContacts: Contact[] = (contactsResult.data ?? []).map((contact) => ({
        ...contact,
        source: "contact" as const,
      }))
      const tenantContacts: Contact[] = []
      for (const tenant of tenantsResult.data ?? []) {
        const name = tenant.full_name || [tenant.first_name, tenant.last_name].filter(Boolean).join(" ") || "Unnamed tenant"
        tenantContacts.push({
          id: `tenant-${tenant.id}`,
          name,
          role: "tenant",
          email: tenant.email,
          phone: tenant.phone,
          company: tenant.company ?? null,
          source: "tenant",
        })
        if (tenant.emergency_contact_name || tenant.emergency_contact_phone) {
          tenantContacts.push({
            id: `emergency-${tenant.id}`,
            name: tenant.emergency_contact_name || "Emergency contact",
            role: "emergency contact",
            email: null,
            phone: tenant.emergency_contact_phone,
            company: null,
            source: "emergency",
          })
        }
      }
      setContacts([...savedContacts, ...tenantContacts].sort((a, b) => a.name.localeCompare(b.name)))
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase()
    if (!value) return contacts
    return contacts.filter((contact) => [contact.name, contact.role, contact.email, contact.phone, contact.company].some((field) => field?.toLowerCase().includes(value)))
  }, [contacts, query])

  return <main className="space-y-6">
    <header><h1 className="text-3xl font-bold tracking-tight">Contacts</h1><p className="mt-1 text-muted-foreground">Search your own tenants, clients, contractors, owners, and other contacts.</p></header>
    <Card><CardContent className="pt-6"><div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search contacts by name, phone, email, or company" className="pl-9" aria-label="Search contacts" /></div></CardContent></Card>
    {error && <Card className="border-destructive/50"><CardContent className="pt-6 text-sm text-destructive">Could not load contacts: {error}</CardContent></Card>}
    <Card><CardHeader><CardTitle>{loading ? "Loading contacts…" : `${filtered.length} contact${filtered.length === 1 ? "" : "s"}`}</CardTitle></CardHeader><CardContent>
      {loading ? <p className="text-sm text-muted-foreground">Loading your contacts…</p> : filtered.length === 0 ? <div className="py-12 text-center"><UserRound className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-medium">{contacts.length ? "No matching contacts" : "No contacts yet"}</p><p className="mt-1 text-sm text-muted-foreground">Only contacts saved in your account will appear here.</p></div> : <div className="divide-y">{filtered.map((contact) => <div key={contact.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-medium">{contact.name}</p><p className="text-sm text-muted-foreground">{contact.email || contact.phone || contact.company || "No contact details"}</p><p className="text-xs text-muted-foreground/80">{contact.source === "tenant" ? "From tenants" : contact.source === "emergency" ? "From tenant emergency contact" : "Saved contact"}</p></div><Badge variant="secondary">{contact.role}</Badge></div>)}</div>}
    </CardContent></Card>
  </main>
}
