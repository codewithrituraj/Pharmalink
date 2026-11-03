"use client"

import { startTransition, useEffect, useMemo, useState } from "react"
import { Download, FileText } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { fetchJson } from "@/lib/client-fetch"

type H1Entry = {
  id: string
  buyerName: string
  patientName: string
  prescriberName: string
  prescriberRegistrationNumber: string
  quantity: number
  createdAt: string
  buyer?: { name: string; drugLicense?: string | null }
  product: { id: string; name: string; genericName: string; strength: string; packSize: string }
  order: { id: string; poNumber: string | null }
}

export function H1RegisterTable({ apiPath, exportPath }: { apiPath: string; exportPath: string }) {
  const [entries, setEntries] = useState<H1Entry[]>([])
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [productId, setProductId] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const params = useMemo(() => {
    const query = new URLSearchParams()
    if (from) query.set("from", from)
    if (to) query.set("to", to)
    if (productId) query.set("productId", productId)
    return query
  }, [from, productId, to])

  useEffect(() => {
    let active = true
    startTransition(() => {
      setLoading(true)
      setError("")
    })
    fetchJson<H1Entry[]>(`${apiPath}${params.size ? `?${params}` : ""}`)
      .then((data) => {
        if (!active) return
        setEntries(data ?? [])
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setError("The Schedule H1 register could not be loaded.")
        setLoading(false)
      })
    return () => { active = false }
  }, [apiPath, params])

  const products = useMemo(
    () => [...new Map(entries.map((entry) => [entry.product.id, entry.product.name])).entries()],
    [entries],
  )

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Controlled medicine records</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Schedule H1 register</h1>
        <p className="mt-2 text-muted-foreground">Register entries are written in the same transaction as their purchase orders.</p>
      </div>

      <Card className="surface-card border-0">
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_1fr_1.3fr_auto] md:items-end">
          <label className="text-sm font-medium">From<Input className="mt-1 h-11" type="date" aria-label="Register from date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label className="text-sm font-medium">To<Input className="mt-1 h-11" type="date" aria-label="Register to date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
          <label className="text-sm font-medium">Product
            <select aria-label="Filter H1 register by product" className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm" value={productId} onChange={(event) => setProductId(event.target.value)}>
              <option value="">All products</option>
              {products.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <a
            href={`${exportPath}${params.size ? `?${params}` : ""}`}
            className={`${buttonVariants({ variant: "outline" })} min-h-11`}
          >
            <Download className="mr-2 size-4" /> Export CSV
          </a>
        </CardContent>
      </Card>

      <Card className="surface-card border-0">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Register entries</CardTitle>
          <span className="text-sm text-muted-foreground">{loading ? "Loading" : `${entries.length} entries`}</span>
        </CardHeader>
        <CardContent>
          {error ? <p role="alert" className="py-8 text-center text-sm text-destructive">{error}</p> : loading ? (
            <div className="h-32 animate-pulse rounded-lg bg-muted" />
          ) : entries.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead><tr className="border-b border-border text-xs uppercase text-muted-foreground"><th className="px-3 py-3">Date / PO</th><th className="px-3 py-3">Buyer</th><th className="px-3 py-3">Product</th><th className="px-3 py-3">Patient</th><th className="px-3 py-3">Prescriber</th><th className="px-3 py-3 text-right">Qty</th></tr></thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-3"><p>{new Date(entry.createdAt).toLocaleDateString("en-IN")}</p><p className="mt-1 text-xs text-muted-foreground">{entry.order.poNumber ?? entry.order.id}</p></td>
                      <td className="px-3 py-3">{entry.buyer?.name ?? entry.buyerName}</td>
                      <td className="px-3 py-3"><p className="font-medium">{entry.product.name}</p><p className="mt-1 text-xs text-muted-foreground">{entry.product.genericName} · {entry.product.strength} · {entry.product.packSize}</p></td>
                      <td className="px-3 py-3">{entry.patientName}</td>
                      <td className="px-3 py-3"><p>{entry.prescriberName}</p><p className="mt-1 text-xs text-muted-foreground">Reg. {entry.prescriberRegistrationNumber}</p></td>
                      <td className="px-3 py-3 text-right font-semibold">{entry.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center">
              <FileText className="mx-auto size-9 text-primary" />
              <p className="mt-3 font-semibold">No register entries for this filter</p>
              <p className="mt-1 text-sm text-muted-foreground">H1 entries appear when a qualifying order is successfully placed.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}