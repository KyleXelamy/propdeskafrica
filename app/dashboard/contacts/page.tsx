import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Plus, Search, Phone, MessageCircle, Mail, Contact } from "lucide-react"

export const metadata: Metadata = {
  title: "Contacts — I-Manage",
  description: "Tenants, contractors, agents, owners — one rolodex.",
}

const contacts = [
  {
    id: "C-001",
    name: "Brian Mwangi",
    role: "Tenant",
    property: "Karen House 1",
    phone: "+254 712 345 678",
    email: "brian@example.com",
    lastContact: "2026-09-22",
  },
  {
    id: "C-002",
    name: "AquaFix Plumbing",
    role: "Contractor",
    property: "All properties",
    phone: "+254 720 000 111",
    email: "ops@aquafix.co.ke",
    lastContact: "2026-09-22",
  },
  {
    id: "C-003",
    name: "Aisha Otieno",
    role: "Tenant",
    property: "Riverside Apt 4B",
    phone: "+254 722 555 222",
    email: "aisha@example.com",
    lastContact: "2026-09-04",
  },
  {
    id: "C-004",
    name: "Highland Estates Group",
    role: "Owner",
    property: "Karen House 1, 2, 3",
    phone: "+254 711 888 999",
    email: "owners@highland.co.ke",
    lastContact: "2026-09-18",
  },
  {
    id: "C-005",
    name: "Prime Paints Ltd",
    role: "Contractor",
    property: "Exterior jobs",
    phone: "+254 720 444 333",
    email: "team@primepaints.co.ke",
    lastContact: "2026-09-18",
  },
  {
    id: "C-006",
    name: "Joseph Kamau",
    role: "Tenant",
    property: "Westlands Studio",
    phone: "+254 798 111 222",
    email: "joseph@example.com",
    lastContact: "2026-08-28",
  },
]

const roleStyles: Record<string, string> = {
  Tenant: "bg-primary text-primary-foreground",
  Contractor: "bg-secondary text-secondary-foreground",
  Owner: "bg-warning/15 text-warning",
  Agent: "bg-accent text-accent-foreground",
}

export default function ContactsPage() {
  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contacts</h1>
          <p className="mt-1 text-muted-foreground">
            Every tenant, contractor, agent and owner in one place. Click to call, message or email.
          </p>
        </div>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 size-4" /> Add contact
        </Button>
      </header>

      {/* Search + filter */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by name, phone, email…" />
        </div>
        {["All", "Tenants", "Contractors", "Owners", "Agents"].map((r, i) => (
          <Button
            key={r}
            variant={i === 0 ? "default" : "outline"}
            size="sm"
            className={i === 0 ? "bg-primary text-primary-foreground" : ""}
          >
            {r}
          </Button>
        ))}
      </div>

      {/* Contacts grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {contacts.map((c) => (
          <Card key={c.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 place-items-center rounded-full bg-secondary text-sm font-medium text-primary">
                    {c.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <CardTitle className="text-base leading-tight">{c.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">{c.property}</p>
                  </div>
                </div>
                <Badge className={roleStyles[c.role]}>{c.role}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="size-3.5 text-muted-foreground" />
                <span className="font-mono">{c.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="size-3.5 text-muted-foreground" />
                <span className="truncate">{c.email}</span>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <Phone className="mr-1.5 size-3.5" /> Call
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <MessageCircle className="mr-1.5 size-3.5" /> WhatsApp
                </Button>
              </div>
              <p className="pt-1 text-xs text-muted-foreground">
                Last contact: {c.lastContact}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}