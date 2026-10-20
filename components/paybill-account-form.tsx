"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"

export function PaybillAccountForm() {
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([])
  const [label, setLabel] = useState("")
  const [number, setNumber] = useState("")
  const [type, setType] = useState<"paybill" | "till">("paybill")
  const [propertyIds, setPropertyIds] = useState<string[]>([])
  const [phone, setPhone] = useState("")
  const [amount, setAmount] = useState("10")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [savedId, setSavedId] = useState("")

  useEffect(() => {
    createClient().from("properties").select("id, name").order("name").then(({ data }) => setProperties(data || []))
  }, [])

  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("")
    const response = await fetch("/api/paybill", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ label, number, type, property_ids: propertyIds }) })
    const body = await response.json().catch(() => ({})); setBusy(false)
    if (!response.ok) return setMessage(body.error || "Could not save account")
    setSavedId(body.paybill.id); setMessage("Payment account saved.")
  }

  async function testPayment(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("")
    const response = await fetch("/api/paybill/test-payment", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ paybill_id: savedId, phone, amount }) })
    const body = await response.json().catch(() => ({})); setBusy(false)
    setMessage(response.ok ? "Test payment request sent. Complete it on your phone, then check the payment feed." : body.error || "Could not start test payment")
  }

  return <div className="grid gap-4 lg:grid-cols-2">
    <Card><CardHeader><CardTitle>Add a payment account</CardTitle><CardDescription>Choose the payment route your tenants already use. PayBill and Till details are kept separate.</CardDescription></CardHeader><CardContent><form onSubmit={save} className="space-y-4">
      <div className="grid gap-2"><Label htmlFor="account-label">Label</Label><Input id="account-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Main rent account" required /></div>
      <div className="grid gap-2"><Label htmlFor="account-number">{type === "paybill" ? "Business number" : "Till number"}</Label><Input id="account-number" inputMode="numeric" value={number} onChange={(e) => setNumber(e.target.value)} placeholder={type === "paybill" ? "e.g. 123456" : "e.g. 1234567"} required /><p className="text-xs text-muted-foreground">{type === "paybill" ? "Tenants use this number together with an account reference." : "Tenants pay directly to this Till number; no account reference is needed."}</p></div>
      <div className="grid gap-2"><Label htmlFor="account-type">Payment route</Label><select id="account-type" value={type} onChange={(e) => setType(e.target.value as "paybill" | "till")} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="paybill">PayBill — business number + account reference</option><option value="till">Till — direct payment</option></select></div>
      <fieldset className="grid gap-2"><legend className="text-sm font-medium">Properties served</legend>{properties.length ? properties.map((property) => <label key={property.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={propertyIds.includes(property.id)} onChange={() => setPropertyIds((ids) => ids.includes(property.id) ? ids.filter((id) => id !== property.id) : [...ids, property.id])} />{property.name}</label>) : <p className="text-xs text-muted-foreground">Add a property before connecting a payment account.</p>}</fieldset>
      <Button disabled={busy || propertyIds.length === 0}>{busy ? "Saving…" : "Save payment account"}</Button>
    </form></CardContent></Card>
    {savedId && <Card><CardHeader><CardTitle>Test the connection</CardTitle><CardDescription>Use a small amount and your own phone. Never ask tenants to test a live setup.</CardDescription></CardHeader><CardContent><form onSubmit={testPayment} className="space-y-4"><div className="grid gap-2"><Label htmlFor="test-phone">M-Pesa phone number</Label><Input id="test-phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XXXXXXXX" required /></div><div className="grid gap-2"><Label htmlFor="test-amount">Amount in KES</Label><Input id="test-amount" type="number" min="1" max="100" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div><Button disabled={busy}>{busy ? "Sending…" : "Send test payment"}</Button></form></CardContent></Card>}
    {message && <p className="text-sm text-muted-foreground lg:col-span-2" role="status">{message}</p>}
  </div>
}
