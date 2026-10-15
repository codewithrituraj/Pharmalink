"use client"

import { useEffect, useMemo, useState } from "react"
import { FileText, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ShareWhatsAppButton } from "@/components/share-whatsapp-button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { fetchJson } from "@/lib/client-fetch"

type Invoice = {
  id: string
  invoiceNumber: string | null
  poNumber: string | null
  invoiceDate: string | null
  status: string
  total: number
  subtotal: number
  discount: number
  gst: number
  manufacturer: string
  stockist: string
  items: { product: { name: string; hsnCode: string | null }; quantity: number; price: number }[]
}

export default function StockistInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [search, setSearch] = useState("")
  const [manufacturer, setManufacturer] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    const params = new URLSearchParams()
    if (from) params.set("from", from)
    if (to) params.set("to", to)

    fetchJson<Invoice[]>(`/api/stockist/invoices${params.size ? `?${params.toString()}` : ""}`)
      .then((data) => {
        if (!active) return
        setInvoices(data ?? [])
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setInvoices([])
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [from, to])

  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase()
    return invoices.filter((invoice) => {
      const matchesManufacturer = !manufacturer || invoice.manufacturer === manufacturer
      const matchesText =
        !text ||
        [
          invoice.invoiceNumber,
          invoice.poNumber,
          invoice.manufacturer,
          invoice.stockist,
          ...invoice.items.map((item) => item.product.name),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(text)

      return matchesManufacturer && matchesText
    })
  }, [invoices, manufacturer, search])

  const uniqueManufacturers = useMemo(
    () => [...new Set(invoices.map((invoice) => invoice.manufacturer))].sort(),
    [invoices],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">Invoices & billing</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Tax invoices</h2>
          <p className="mt-2 text-muted-foreground">Real invoice records for your verified orders and downloadable PDFs.</p>
        </div>
      </div>

      <Card className="surface-card border-0">
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_auto_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search invoice, PO, or manufacturer"
              aria-label="Search invoices"
              className="h-11 pl-9"
            />
          </div>
          <select
            value={manufacturer}
            onChange={(event) => setManufacturer(event.target.value)}
            aria-label="Filter invoices by manufacturer"
            className="h-11 min-w-[180px] rounded-lg border border-border bg-background px-3 text-sm"
          >
            <option value="">All manufacturers</option>
            {uniqueManufacturers.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
          <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="Invoices from" className="h-11" />
          <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="Invoices to" className="h-11" />
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/5"><CardContent className="py-4"><p className="font-semibold">Invoice integrity</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Each tax invoice is tied to one confirmed purchase order, its GST totals and batch allocations. The number and issue date shown here are the persisted server record; the downloaded PDF carries the same details for verification.</p></CardContent></Card>

      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-muted" />
      ) : filtered.length === 0 ? (
        <Card className="surface-card border-0">
          <CardContent className="py-16 text-center">
            <FileText className="mx-auto size-10 text-primary" />
            <h3 className="mt-4 font-semibold">No tax invoices yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">Confirmed orders will show up here with a generated invoice and PDF download.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((invoice) => (
            <Card key={invoice.id} className="surface-card border-0">
              <CardHeader className="flex flex-col gap-3 pb-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-lg">
                    {invoice.invoiceNumber ?? "Invoice pending"}
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {invoice.poNumber} · {invoice.manufacturer} · {invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString("en-IN") : "Invoice date pending"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {invoice.status}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(`/api/stockist/invoices/${invoice.id}/pdf`, "_blank")}
                  >
                    <FileText className="mr-2 size-4" /> Download PDF
                  </Button>
                  <ShareWhatsAppButton message={`PharmaLink tax invoice ${invoice.invoiceNumber ?? invoice.poNumber} · ${invoice.manufacturer} · ₹${invoice.total.toFixed(2)}`} path={`/api/stockist/invoices/${invoice.id}/pdf`} />
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Total</p>
                    <p className="mt-1 text-2xl font-semibold number">₹{invoice.total.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Tax</p>
                    <p className="mt-1 text-base font-medium number">₹{invoice.gst.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Discount</p>
                    <p className="mt-1 text-base font-medium number">₹{invoice.discount.toFixed(2)}</p>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-border">
                  <div className="grid min-w-[32rem] grid-cols-[1.4fr_0.7fr_0.6fr_0.5fr] gap-3 bg-muted/50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    <span>Product</span>
                    <span>HSN</span>
                    <span className="text-right">Qty</span>
                    <span className="text-right">Price</span>
                  </div>
                  {invoice.items.map((item, index) => (
                    <div key={`${invoice.id}-${index}`} className="grid min-w-[32rem] grid-cols-[1.4fr_0.7fr_0.6fr_0.5fr] gap-3 border-t border-border px-3 py-2 text-sm">
                      <span>{item.product.name}</span>
                      <span>{item.product.hsnCode ?? "N/A"}</span>
                      <span className="text-right">{item.quantity}</span>
                      <span className="text-right number">₹{item.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
