"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Download, FileText, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { fetchJson } from "@/lib/client-fetch"

type Order = { id: string; poNumber: string | null; createdAt: string; status: string; total: number; seller: { name: string }; items: { product: { name: string } }[] }
const statuses = ["PLACED", "APPROVED", "PACKED", "DISPATCHED", "DELIVERED", "REJECTED", "CANCELLED"]
function statusVariant(status: string) { return status === "DELIVERED" ? "default" : status === "REJECTED" || status === "CANCELLED" ? "destructive" : status === "PLACED" ? "secondary" : "outline" }

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let mounted = true
    fetchJson<Order[]>("/api/stockist/orders").then((data) => {
      if (mounted) {
        setOrders(data ?? [])
        setLoading(false)
      }
    })
    return () => {
      mounted = false
    }
  }, [])
  const filtered = useMemo(() => orders.filter((order) => {
    const date = new Date(order.createdAt)
    const text = `${order.poNumber} ${order.seller.name} ${order.items.map((item) => item.product.name).join(" ")}`.toLowerCase()
    return (!status || order.status === status) && (!dateFrom || date >= new Date(`${dateFrom}T00:00:00`)) && (!dateTo || date <= new Date(`${dateTo}T23:59:59`)) && (!query || text.includes(query.toLowerCase()))
  }), [dateFrom, dateTo, orders, query, status])
  function exportCsv() {
    const csv = ["PO,Date,Manufacturer,Status,Total", ...filtered.map((order) => [order.poNumber ?? order.id, new Date(order.createdAt).toLocaleDateString(), order.seller.name, order.status, order.total.toFixed(2)].map((value) => `"${value.replaceAll('"', '""')}"`).join(","))].join("\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
    const link = document.createElement("a")
    link.href = url
    link.download = "pharmalink-orders.csv"
    link.click()
    URL.revokeObjectURL(url)
  }
  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="eyebrow">Procurement history</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Purchase orders</h2><p className="mt-2 text-muted-foreground">Track every order from placement through delivery.</p></div><Button variant="outline" className="min-h-11" onClick={exportCsv}><Download className="size-4" /> Export CSV</Button></div>
    <Card className="surface-card border-0"><CardContent className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]"><div className="relative min-w-0"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search PO, manufacturer, or product..." aria-label="Search orders" className="h-11 pl-9" /></div><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter orders by status" className="h-11 rounded-lg border border-border bg-background px-3 text-sm"><option value="">All statuses</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select><Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} aria-label="Orders from date" className="h-11" /><Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} aria-label="Orders to date" className="h-11" /></CardContent></Card>
    {loading ? <div className="h-72 animate-pulse rounded-2xl bg-muted" /> : filtered.length === 0 ? <Card className="surface-card border-0"><CardContent className="py-16 text-center"><FileText className="mx-auto size-10 text-primary" /><h3 className="mt-4 font-semibold">No purchase orders found</h3><p className="mt-2 text-sm text-muted-foreground">Orders will appear here after you place a PO from the catalogue.</p></CardContent></Card> : <Card className="surface-card border-0"><CardHeader><CardTitle>{filtered.length} orders</CardTitle></CardHeader><CardContent className="space-y-3">{filtered.map((order) => <Link key={order.id} href={`/stockist/orders/${order.id}`} className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/60 p-4 transition hover:border-primary/50 hover:bg-primary/5 md:flex-row md:items-center md:justify-between"><div><p className="font-semibold">{order.poNumber ?? `PO-${order.id.slice(-8).toUpperCase()}`}</p><p className="mt-1 text-xs text-muted-foreground">{order.seller.name} · {new Date(order.createdAt).toLocaleDateString()} · {order.items.length} line items</p></div><div className="flex items-center justify-between gap-4 md:justify-end"><span className="number font-semibold">₹{order.total.toFixed(2)}</span><Badge variant={statusVariant(order.status)}>{order.status}</Badge><span className="text-xs text-primary">View <span aria-hidden="true">→</span></span></div></Link>)}</CardContent></Card>}
  </div>
}
