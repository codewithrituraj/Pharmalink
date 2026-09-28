"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, CheckCircle2, Factory, Filter, MapPin, Search, ShieldCheck, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"

type Access = { id: string; status: string; message?: string | null }
type Manufacturer = { id: string; name: string; region: string | null; drugLicense: string | null; productCount: number; categories: string[]; access: Access | null }

const statusCopy: Record<string, string> = { VERIFIED: "Approved", PENDING: "Pending", REJECTED: "Rejected" }

export default function ManufacturersPage() {
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [query, setQuery] = useState("")
  const [region, setRegion] = useState("")
  const [category, setCategory] = useState("")
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Manufacturer | null>(null)
  const [message, setMessage] = useState("")
  const [requesting, setRequesting] = useState(false)
  const { toast } = useToast()

  const loadManufacturers = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (query.trim()) params.set("q", query.trim())
    if (region) params.set("region", region)
    if (category) params.set("category", category)
    const response = await fetch(`/api/stockist/manufacturers?${params.toString()}`)
    if (response.ok) setManufacturers(await response.json())
    setLoading(false)
  }, [category, query, region])

  useEffect(() => {
    const timer = window.setTimeout(loadManufacturers, 250)
    return () => window.clearTimeout(timer)
  }, [loadManufacturers])

  const categories = useMemo(() => [...new Set(manufacturers.flatMap((manufacturer) => manufacturer.categories))].sort(), [manufacturers])
  const regions = useMemo(() => [...new Set(manufacturers.map((manufacturer) => manufacturer.region).filter((item): item is string => Boolean(item)))].sort(), [manufacturers])

  async function requestAccess() {
    if (!selected) return
    setRequesting(true)
    const response = await fetch("/api/stockist/manufacturers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ manufacturerId: selected.id, message }) })
    const data = await response.json()
    setRequesting(false)
    if (!response.ok) {
      toast({ variant: "destructive", title: "Request not sent", description: data.error ?? "Please try again." })
      return
    }
    toast({ title: "Access request sent", description: `${selected.name} will review your request.` })
    setSelected(null)
    setMessage("")
    await loadManufacturers()
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="eyebrow">Network discovery</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Manufacturers</h2><p className="mt-2 max-w-2xl text-muted-foreground">Connect with verified manufacturers before pricing and ordering from their catalogue.</p></div><Link href="/stockist/catalogue" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-semibold hover:bg-muted">Browse approved catalogue <ArrowRight className="size-4" /></Link></div>
      <Card className="surface-card border-0"><CardContent className="flex flex-col gap-3 p-4 md:flex-row"><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search manufacturer name..." aria-label="Search manufacturers" className="h-11 pl-9" /></div><div className="flex items-center gap-2"><Filter className="size-4 text-muted-foreground" /><select value={region} onChange={(event) => setRegion(event.target.value)} aria-label="Filter by region" className="h-11 rounded-lg border border-border bg-background px-3 text-sm"><option value="">All regions</option>{regions.map((item) => <option key={item} value={item}>{item}</option>)}</select><select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by category" className="h-11 rounded-lg border border-border bg-background px-3 text-sm"><option value="">All categories</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></div></CardContent></Card>
      {loading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-56 animate-pulse rounded-2xl bg-muted" />)}</div> : manufacturers.length === 0 ? <Card className="surface-card border-0"><CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center"><Factory className="size-10 text-primary" /><h3 className="mt-4 text-lg font-semibold">No manufacturers match those filters</h3><p className="mt-2 max-w-md text-sm text-muted-foreground">Try clearing a filter or searching by a broader manufacturer name.</p><Button variant="outline" className="mt-5" onClick={() => { setQuery(""); setRegion(""); setCategory("") }}>Clear filters</Button></CardContent></Card> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{manufacturers.map((manufacturer) => { const accessLabel = manufacturer.access ? statusCopy[manufacturer.access.status] : "Not requested"; const approved = manufacturer.access?.status === "VERIFIED"; return <Card key={manufacturer.id} className="surface-card border-0"><CardHeader><div className="flex items-start justify-between gap-3"><div className="grid size-11 place-items-center rounded-xl bg-secondary text-primary"><Factory className="size-5" /></div><Badge variant={approved ? "default" : manufacturer.access?.status === "REJECTED" ? "destructive" : "outline"}>{approved && <CheckCircle2 className="mr-1 size-3" />}{accessLabel}</Badge></div><CardTitle className="mt-4">{manufacturer.name}</CardTitle><p className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-3.5" /> {manufacturer.region ?? "Region not listed"}</p></CardHeader><CardContent><div className="flex items-center justify-between border-y border-border/70 py-3 text-sm"><span className="text-muted-foreground">Verified catalogue</span><span className="font-semibold">{manufacturer.productCount} products</span></div><div className="mt-3 flex flex-wrap gap-1.5">{manufacturer.categories.slice(0, 4).map((item) => <span key={item} className="rounded-full bg-muted px-2 py-1 text-[0.68rem] text-muted-foreground">{item}</span>)}</div><div className="mt-5 flex items-center justify-between gap-3"><span className="flex items-center gap-1 text-xs text-muted-foreground"><ShieldCheck className="size-3.5 text-primary" /> {manufacturer.drugLicense}</span>{approved ? <Link href="/stockist/catalogue" className="text-sm font-semibold text-primary hover:underline">View catalogue</Link> : <Button className="min-h-11" onClick={() => setSelected(manufacturer)}>{manufacturer.access?.status === "PENDING" ? "Edit request" : "Request access"}</Button>}</div></CardContent></Card> })}</div>}
      {selected && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null) }}><div role="dialog" aria-modal="true" aria-labelledby="access-request-title" className="w-full max-w-lg rounded-t-2xl bg-background p-6 shadow-2xl sm:rounded-2xl"><div className="flex items-start justify-between"><div><p className="eyebrow">Access request</p><h3 id="access-request-title" className="mt-1 text-xl font-semibold">Connect with {selected.name}</h3></div><button type="button" onClick={() => setSelected(null)} className="grid size-11 place-items-center rounded-lg hover:bg-muted" aria-label="Close request dialog"><X className="size-5" /></button></div><p className="mt-4 text-sm leading-6 text-muted-foreground">Share a short note with the manufacturer. Your verified business details will be included automatically.</p><textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={500} placeholder="Tell them about your territory or product needs (optional)" className="mt-4 min-h-28 w-full resize-y rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" /><div className="mt-5 flex justify-end gap-3"><Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button><Button onClick={requestAccess} disabled={requesting}>{requesting ? "Sending..." : "Send request"}</Button></div></div></div>}
    </div>
  )
}
