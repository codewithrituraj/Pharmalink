"use client"

import { useState } from "react"
import { CreditCard } from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useApiResource } from "@/hooks/use-api-resource"

type Payment = { id:string; amount:number; reference:string; status:string; submittedAt:string; reviewNote:string|null; stockist:{name:string}; order:{poNumber:string|null;invoiceNumber:string|null;total:number;paidAmount:number;paymentStatus:string}; reviewer:{email:string}|null }

export default function ManufacturerPaymentsPage() {
  const { data, loading, error, refresh } = useApiResource<Payment[]>("/api/manufacturer/payments")
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState("")

  async function decide(id: string, action: "CONFIRMED" | "REJECTED") {
    setSaving(id)
    setMessage("")
    const response = await fetch("/api/manufacturer/payments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }) })
    const body = await response.json()
    setSaving(null)
    setMessage(response.ok ? `Payment ${action.toLowerCase()}.` : body.error ?? "Payment review failed.")
    if (response.ok) refresh()
  }

  return <div className="space-y-6"><div><p className="eyebrow">Receivables</p><h1 className="mt-2 text-3xl font-semibold">Payment confirmations</h1><p className="mt-2 text-muted-foreground">Confirm or reject payment references submitted by stockists.</p></div>{message?<p role="status" className="text-sm text-muted-foreground">{message}</p>:null}{error?<button onClick={refresh} className="text-destructive">{error} — Retry</button>:null}{loading?<Card><CardContent className="py-10">Loading payment submissions…</CardContent></Card>:!data?.length?<EmptyState icon={CreditCard} title="No payment submissions" description="Stockist payment references awaiting review appear here."/>:<div className="space-y-3">{data.map(payment=><Card key={payment.id} className="surface-card border-0"><CardContent className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{payment.order.invoiceNumber??payment.order.poNumber??"Invoice"} · {payment.stockist.name}</p><p className="mt-1 text-sm text-muted-foreground">₹{payment.amount.toLocaleString("en-IN",{minimumFractionDigits:2})} · {payment.reference} · {new Date(payment.submittedAt).toLocaleDateString("en-IN")}</p><p className="mt-1 text-xs text-muted-foreground">Status: {payment.status}{payment.reviewer?` · reviewed by ${payment.reviewer.email}`:""}</p></div>{payment.status==="SUBMITTED"?<div className="flex gap-2"><Button size="sm" disabled={saving===payment.id} onClick={()=>decide(payment.id,"CONFIRMED")}>Confirm</Button><Button size="sm" variant="destructive" disabled={saving===payment.id} onClick={()=>decide(payment.id,"REJECTED")}>Reject</Button></div>:null}</CardContent></Card>)}</div>}</div>
}
