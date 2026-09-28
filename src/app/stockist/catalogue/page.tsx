"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, ArrowRight, Heart, Minus, PackageSearch, Plus, Search, SlidersHorizontal, Sparkles, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"

type Scheme = { id: string; name: string; type: string; minQuantity: number; discountPercent: number; freeQuantity: number }
type Product = { id: string; name: string; genericName: string; category: string; dosageForm: string; strength: string; packSize: string; gstPercent: number; isPrescription: boolean; storage: string; minOrderQty: number; ptr: number; pts: number; mrp: number; manufacturerId: string; manufacturer: { name: string; region: string | null }; totalStock: number; availability: string; isFavourite: boolean; batches?: { expiryDate: string }[]; schemes: Scheme[] }
type CartItem = { product: Product; quantity: number }

const initialFilters = { manufacturerId: "", dosageForm: "", strength: "", minPrice: "", maxPrice: "", availability: "", prescription: "" }

export default function CataloguePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const [query, setQuery] = useState(searchParams.get("q") ?? "")
  const [filters, setFilters] = useState(initialFilters)
  const [sort, setSort] = useState("relevance")
  const [page, setPage] = useState(1)
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [cart, setCart] = useState<CartItem[]>([])
  const [notes, setNotes] = useState("")
  const [detail, setDetail] = useState<Product | null>(null)
  const [mobileFilters, setMobileFilters] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadProducts = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ q: query, sort, page: String(page), pageSize: "12" })
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value) })
    const response = await fetch(`/api/stockist/search?${params}`)
    if (response.ok) {
      const data = await response.json()
      setProducts(data.products)
      setTotal(data.total)
      setPages(data.pages)
    }
    setLoading(false)
  }, [filters, page, query, sort])

  // A reorder saved from smart insights lands in a real server-side draft, so
  // load it into the cart once when the page opens.
  useEffect(() => {
    let cancelled = false

    fetch("/api/stockist/reorder")
      .then((response) => (response.ok ? response.json() : null))
      .then(async (payload: { drafts?: { notes: string; items: { productId: string; quantity: number }[] }[] } | null) => {
        if (cancelled || !payload?.drafts?.length) return
        const draft = payload.drafts[0]
        const detailed = await Promise.all(
          draft.items.map(async (item) => {
            const productResponse = await fetch(`/api/stockist/products/${item.productId}`)
            if (!productResponse.ok) return null
            return { product: (await productResponse.json()) as Product, quantity: item.quantity }
          }),
        )
        if (cancelled) return
        const validItems = detailed.filter((item): item is CartItem => item !== null)
        if (validItems.length) {
          setCart(validItems)
          setNotes(draft.notes)
        }
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(loadProducts, 250)
    return () => window.clearTimeout(timer)
  }, [loadProducts])

  const manufacturers = useMemo(() => [...new Map(products.map((product) => [product.manufacturerId, product.manufacturer.name]))], [products])
  const dosageForms = useMemo(() => [...new Set(products.map((product) => product.dosageForm))], [products])
  const manufacturerId = cart[0]?.product.manufacturerId
  const subtotal = cart.reduce((sum, item) => sum + item.product.ptr * item.quantity, 0)
  const discount = cart.reduce((sum, item) => {
    const scheme = item.product.schemes.find((candidate) => item.quantity >= candidate.minQuantity)
    return sum + (scheme ? item.product.ptr * item.quantity * scheme.discountPercent / 100 : 0)
  }, 0)
  const gst = cart.reduce((sum, item) => sum + item.product.ptr * item.quantity * item.product.gstPercent / 100, 0)

  function updateFilter(key: keyof typeof initialFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }))
    setPage(1)
  }
  function addToCart(product: Product) {
    if (manufacturerId && manufacturerId !== product.manufacturerId) {
      toast({ variant: "destructive", title: "One manufacturer per PO", description: "Finish or clear the current PO before adding another manufacturer." })
      return
    }
    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id)
      return existing ? current.map((item) => item.product.id === product.id ? { ...item, quantity: item.quantity + product.minOrderQty } : item) : [...current, { product, quantity: product.minOrderQty }]
    })
    toast({ title: "Added to PO", description: `${product.name} added at MOQ ${product.minOrderQty}.` })
  }
  function changeQuantity(productId: string, amount: number) {
    setCart((current) => current.map((item) => item.product.id === productId ? { ...item, quantity: Math.max(item.product.minOrderQty, item.quantity + amount) } : item))
  }
  async function toggleFavourite(product: Product) {
    const response = await fetch(`/api/stockist/products/${product.id}/favourite`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: product.id }) })
    if (!response.ok) return
    const data = await response.json()
    setProducts((current) => current.map((item) => item.id === product.id ? { ...item, isFavourite: data.isFavourite } : item))
    setDetail((current) => current?.id === product.id ? { ...current, isFavourite: data.isFavourite } : current)
  }
  async function saveDraft() {
    if (!manufacturerId || !cart.length) return
    setSaving(true)
    const response = await fetch("/api/stockist/drafts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ manufacturerId, notes, items: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity })) }) })
    setSaving(false)
    toast({ title: response.ok ? "Draft saved" : "Could not save draft", description: response.ok ? "Your PO is saved for later." : "Please try again.", variant: response.ok ? "default" : "destructive" })
  }
  async function placeOrder() {
    if (!manufacturerId || !cart.length) return
    setSaving(true)
    const response = await fetch("/api/stockist/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ manufacturerId, notes, items: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity })) }) })
    const data = await response.json()
    setSaving(false)
    if (!response.ok) { toast({ variant: "destructive", title: "Order failed", description: data.error }); return }
    setCart([])
    setNotes("")
    setConfirmOpen(false)
    router.push(`/stockist/orders/${data.order.id}`)
  }

  const filtersPanel = <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <select value={filters.manufacturerId} onChange={(event) => updateFilter("manufacturerId", event.target.value)} aria-label="Filter by manufacturer" className="h-11 rounded-lg border border-border bg-background px-3 text-sm"><option value="">All manufacturers</option>{manufacturers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
    <select value={filters.dosageForm} onChange={(event) => updateFilter("dosageForm", event.target.value)} aria-label="Filter by dosage form" className="h-11 rounded-lg border border-border bg-background px-3 text-sm"><option value="">All dosage forms</option>{dosageForms.map((form) => <option key={form}>{form}</option>)}</select>
    <Input value={filters.strength} onChange={(event) => updateFilter("strength", event.target.value)} placeholder="Strength" aria-label="Filter by strength" />
    <div className="flex gap-2"><Input type="number" value={filters.minPrice} onChange={(event) => updateFilter("minPrice", event.target.value)} placeholder="Min PTR" aria-label="Minimum PTR" /><Input type="number" value={filters.maxPrice} onChange={(event) => updateFilter("maxPrice", event.target.value)} placeholder="Max PTR" aria-label="Maximum PTR" /></div>
    <select value={filters.availability} onChange={(event) => updateFilter("availability", event.target.value)} aria-label="Filter by availability" className="h-11 rounded-lg border border-border bg-background px-3 text-sm"><option value="">Any availability</option><option value="in-stock">In stock</option><option value="low">Low stock</option><option value="out">Out of stock</option></select>
    <select value={filters.prescription} onChange={(event) => updateFilter("prescription", event.target.value)} aria-label="Filter by prescription status" className="h-11 rounded-lg border border-border bg-background px-3 text-sm"><option value="">Prescription: all</option><option value="yes">Prescription only</option><option value="no">Non-prescription</option></select>
  </div>

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div><p className="eyebrow">Authorized supply</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Catalogue</h2><p className="mt-2 text-muted-foreground">Search verified manufacturers and build one purchase order at a time.</p></div><div className="flex gap-2"><Button variant="outline" className="min-h-11 lg:hidden" onClick={() => setMobileFilters(true)}><SlidersHorizontal className="size-4" /> Filters</Button><select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1) }} aria-label="Sort catalogue" className="h-11 rounded-lg border border-border bg-background px-3 text-sm"><option value="relevance">Most relevant</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="name">Name</option></select></div></div>
    <Card className="surface-card hidden border-0 lg:block"><CardContent className="p-4"><SearchBox query={query} setQuery={(value) => { setQuery(value); setPage(1) }} />{filtersPanel}</CardContent></Card>
    <div className="lg:hidden"><SearchBox query={query} setQuery={(value) => { setQuery(value); setPage(1) }} /></div>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]"><section><div className="mb-3 flex justify-between text-sm text-muted-foreground"><span>{total} products</span><span>Page {page} of {Math.max(pages, 1)}</span></div>{loading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="h-64 animate-pulse rounded-2xl bg-muted" />)}</div> : products.length === 0 ? <Card className="surface-card border-0"><CardContent className="py-16 text-center"><PackageSearch className="mx-auto size-10 text-primary" /><h3 className="mt-4 font-semibold">No products match your search</h3><p className="mt-2 text-sm text-muted-foreground">Try clearing filters or request manufacturer access.</p></CardContent></Card> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{products.map((product) => <ProductCard key={product.id} product={product} onFavourite={toggleFavourite} onDetails={setDetail} onAdd={addToCart} />)}</div>}<div className="mt-6 flex justify-center gap-2"><Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} aria-label="Previous page"><ArrowLeft className="size-4" /></Button><Button variant="outline" size="icon" disabled={page >= pages} onClick={() => setPage((current) => current + 1)} aria-label="Next page"><ArrowRight className="size-4" /></Button></div></section><CartPanel cart={cart} notes={notes} setNotes={setNotes} subtotal={subtotal} discount={discount} gst={gst} saving={saving} onChange={changeQuantity} onClear={() => { setCart([]); setNotes("") }} onSave={saveDraft} onReview={() => setConfirmOpen(true)} /></div>
    {detail && <ProductDrawer product={detail} onClose={() => setDetail(null)} onAdd={addToCart} onFavourite={toggleFavourite} />}
    {mobileFilters && <div className="fixed inset-0 z-50 flex items-end bg-slate-950/40" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMobileFilters(false) }}><div className="w-full rounded-t-2xl bg-background p-6"><div className="mb-5 flex justify-between"><h3 className="font-semibold">Catalogue filters</h3><button type="button" onClick={() => setMobileFilters(false)} className="grid size-11 place-items-center rounded-lg hover:bg-muted" aria-label="Close filters"><X className="size-5" /></button></div>{filtersPanel}<Button className="mt-5 min-h-11 w-full" onClick={() => setMobileFilters(false)}>Apply filters</Button></div></div>}
    {confirmOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"><div className="w-full max-w-md rounded-2xl bg-background p-6 shadow-2xl"><p className="eyebrow">Final review</p><h3 className="mt-1 text-xl font-semibold">Place this purchase order?</h3><p className="mt-3 text-sm text-muted-foreground">The server will recheck access, stock, MOQ, schemes, and GST before reserving inventory.</p><div className="mt-5 flex justify-between font-semibold"><span>Estimated total</span><span>₹{(subtotal - discount + gst).toFixed(2)}</span></div><div className="mt-6 flex gap-3"><Button variant="outline" className="min-h-11 flex-1" onClick={() => setConfirmOpen(false)}>Go back</Button><Button className="min-h-11 flex-1" disabled={saving} onClick={placeOrder}>{saving ? "Placing..." : "Place order"}</Button></div></div></div>}
  </div>
}

function SearchBox({ query, setQuery }: { query: string; setQuery: (value: string) => void }) { return <div className="relative mb-4"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by brand, generic, or manufacturer..." aria-label="Search catalogue" className="h-11 pl-9" /></div> }

function ProductCard({ product, onFavourite, onDetails, onAdd }: { product: Product; onFavourite: (product: Product) => void; onDetails: (product: Product) => void; onAdd: (product: Product) => void }) { return <Card className="surface-card border-0"><CardHeader className="pb-3"><div className="flex justify-between gap-2"><div><CardTitle className="text-base">{product.name}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{product.genericName}</p></div><button type="button" onClick={() => onFavourite(product)} className="grid size-10 place-items-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="Toggle favourite"><Heart className={`size-4 ${product.isFavourite ? "fill-rose-500 text-rose-500" : ""}`} /></button></div><p className="text-xs text-muted-foreground">{product.manufacturer.name} · {product.dosageForm} · {product.packSize}</p></CardHeader><CardContent className="space-y-3"><div className="flex justify-between"><span className="number text-lg font-bold">₹{product.ptr.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">PTR</span></span><Badge variant={product.availability === "In stock" ? "outline" : product.availability === "Low" ? "secondary" : "destructive"}>{product.availability}</Badge></div><p className="text-xs text-muted-foreground">{product.totalStock.toLocaleString()} units · MOQ {product.minOrderQty} · GST {product.gstPercent}%</p>{product.isPrescription && <Badge variant="secondary">Prescription</Badge>}</CardContent><CardFooter className="gap-2"><Button variant="outline" className="min-h-11 flex-1" onClick={() => onDetails(product)}>Details</Button><Button className="min-h-11 flex-1" disabled={product.availability === "Out"} onClick={() => onAdd(product)}>Add to PO</Button></CardFooter></Card> }

function CartPanel({ cart, notes, setNotes, subtotal, discount, gst, saving, onChange, onClear, onSave, onReview }: { cart: CartItem[]; notes: string; setNotes: (value: string) => void; subtotal: number; discount: number; gst: number; saving: boolean; onChange: (id: string, amount: number) => void; onClear: () => void; onSave: () => void; onReview: () => void }) { return <Card className="surface-card h-fit border-0 xl:sticky xl:top-24"><CardHeader><div className="flex justify-between"><CardTitle>Current PO</CardTitle>{cart.length > 0 && <button type="button" onClick={onClear} className="-my-1 inline-flex items-center px-1 py-1 text-xs text-muted-foreground hover:text-destructive">Clear</button>}</div><p className="text-xs text-muted-foreground">One manufacturer per purchase order</p></CardHeader><CardContent className="space-y-4">{cart.length === 0 ? <div className="rounded-xl bg-muted/60 p-6 text-center text-sm text-muted-foreground">Add a product to start your PO.</div> : cart.map((item) => <div key={item.product.id} className="rounded-xl border border-border/70 p-3"><div className="flex justify-between gap-2"><div><p className="text-sm font-medium">{item.product.name}</p><p className="text-xs text-muted-foreground">₹{item.product.ptr.toFixed(2)} · MOQ {item.product.minOrderQty}</p></div><span className="number text-sm font-semibold">₹{(item.product.ptr * item.quantity).toFixed(2)}</span></div><div className="mt-3 flex items-center gap-2"><Button variant="outline" size="icon-sm" onClick={() => onChange(item.product.id, -item.product.minOrderQty)} aria-label="Decrease quantity"><Minus className="size-3" /></Button><span className="number min-w-8 text-center text-sm">{item.quantity}</span><Button variant="outline" size="icon-sm" onClick={() => onChange(item.product.id, item.product.minOrderQty)} aria-label="Increase quantity"><Plus className="size-3" /></Button>{item.product.schemes[0] && item.quantity >= item.product.schemes[0].minQuantity && <span className="ml-auto text-xs text-emerald-700">-{item.product.schemes[0].discountPercent}%</span>}</div></div>)}<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes for manufacturer (optional)" aria-label="Notes for manufacturer" className="min-h-20 w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-primary" /></CardContent><CardFooter className="flex-col gap-3 border-t border-border/70 pt-4"><Summary subtotal={subtotal} discount={discount} gst={gst} /><div className="grid w-full gap-2 sm:grid-cols-2"><Button variant="outline" className="min-h-11" disabled={!cart.length || saving} onClick={onSave}>Save draft</Button><Button className="min-h-11" disabled={!cart.length || saving} onClick={onReview}>Review & place</Button></div></CardFooter></Card> }
function Summary({ subtotal, discount, gst }: { subtotal: number; discount: number; gst: number }) { return <div className="w-full space-y-2 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div><div className="flex justify-between text-emerald-700"><span>Scheme discount</span><span>-₹{discount.toFixed(2)}</span></div><div className="flex justify-between"><span>GST</span><span>₹{gst.toFixed(2)}</span></div><div className="flex justify-between font-semibold"><span>Estimated total</span><span>₹{(subtotal - discount + gst).toFixed(2)}</span></div></div> }

function ProductDrawer({ product, onClose, onAdd, onFavourite }: { product: Product; onClose: () => void; onAdd: (product: Product) => void; onFavourite: (product: Product) => void }) { return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><div role="dialog" aria-modal="true" aria-labelledby="product-detail-title" className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-background p-6 shadow-2xl sm:max-w-xl sm:rounded-2xl"><div className="flex justify-between"><div><p className="eyebrow">Product detail</p><h3 id="product-detail-title" className="mt-1 text-2xl font-semibold">{product.name}</h3><p className="mt-1 text-sm text-muted-foreground">{product.manufacturer.name} · {product.genericName}</p></div><button type="button" onClick={onClose} className="grid size-11 place-items-center rounded-lg hover:bg-muted" aria-label="Close product details"><X className="size-5" /></button></div><div className="mt-6 grid grid-cols-2 gap-3 text-sm"><Info label="PTR / PTS" value={`₹${product.ptr.toFixed(2)} / ₹${product.pts.toFixed(2)}`} /><Info label="MRP / GST" value={`₹${product.mrp.toFixed(2)} / ${product.gstPercent}%`} /><Info label="Pack and form" value={`${product.packSize} · ${product.dosageForm}`} /><Info label="Availability" value={`${product.availability} · ${product.totalStock.toLocaleString()} units`} /></div><p className="mt-5 text-sm"><strong>Storage:</strong> {product.storage}</p><div className="mt-5"><p className="text-sm font-semibold">Active schemes</p>{product.schemes.length ? product.schemes.map((scheme) => <div key={scheme.id} className="mt-2 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"><Sparkles className="size-4" /> {scheme.name}: {scheme.discountPercent}% above {scheme.minQuantity} units</div>) : <p className="mt-1 text-sm text-muted-foreground">No active schemes.</p>}</div><p className="mt-5 text-sm"><strong>Earliest batch expiry:</strong> {new Date(product.batches?.[0]?.expiryDate ?? "").toLocaleDateString()}</p><div className="mt-6 flex gap-2"><Button variant="outline" className="min-h-11" onClick={() => onFavourite(product)}><Heart className={product.isFavourite ? "fill-rose-500 text-rose-500" : ""} /></Button><Button className="min-h-11 flex-1" onClick={() => { onAdd(product); onClose() }}>Add to PO</Button></div></div></div> }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-muted/60 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></div> }
