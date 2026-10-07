"use client"

import { useEffect, useMemo, useState } from "react"
import { Search, UserRound } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"

type Contact = { id: string; name: string; role: string; email: string | null; phone: string | null; company: string | null }

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    createClient().from("contacts").select("id, name, role, email, phone, company").order("name").then(({ data, error }) => {
      if (!active) return
      if (error) setError(error.message)
      else setContacts((data ?? []) as Contact[])
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
      {loading ? <p className="text-sm text-muted-foreground">Loading your contacts…</p> : filtered.length === 0 ? <div className="py-12 text-center"><UserRound className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-medium">{contacts.length ? "No matching contacts" : "No contacts yet"}</p><p className="mt-1 text-sm text-muted-foreground">Only contacts saved in your account will appear here.</p></div> : <div className="divide-y">{filtered.map((contact) => <div key={contact.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-medium">{contact.name}</p><p className="text-sm text-muted-foreground">{contact.email || contact.phone || contact.company || "No contact details"}</p></div><Badge variant="secondary">{contact.role}</Badge></div>)}</div>}
    </CardContent></Card>
  </main>
}
