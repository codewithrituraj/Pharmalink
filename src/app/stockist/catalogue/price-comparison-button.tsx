"use client"

import { useState } from "react"
import { ArrowLeftRight, FileText, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Product = {
  name: string
  genericName: string
  strength: string
  dosageForm: string
  minOrderQty: number
}

type Offer = {
  id: string
  name: string
  manufacturer: string
  ptr: number
  ptrAfterScheme: number
  gstPercent: number
  estimatedUnitIncludingGst: number
  discountPercent: number
  schemeName: string | null
  quantity: number
  meetsMoq: boolean
  minOrderQty: number
  leadTimeDays: number
  stock: number
  availability: string
}

export function PriceComparisonButton({ product }: { product: Product }) {
  const [open, setOpen] = useState(false)
  const [quantity, setQuantity] = useState(product.minOrderQty)
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function loadOffers() {
    setLoading(true)
    setError("")
    const params = new URLSearchParams({
      genericName: product.genericName,
      strength: product.strength,
      dosageForm: product.dosageForm,
      quantity: String(quantity),
    })

    try {
      const response = await fetch(`/api/stockist/price-comparison?${params}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? "Could not compare manufacturer offers")
      setOffers(data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not compare manufacturer offers")
    } finally {
      setLoading(false)
    }
  }

  function openComparison() {
    setOpen(true)
    void loadOffers()
  }

  return (
    <>
      <Button variant="outline" className="min-h-11 flex-1" onClick={openComparison}>
        <ArrowLeftRight className="size-4" /> Compare
      </Button>

      {open ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}>
          <section role="dialog" aria-modal="true" aria-labelledby="price-comparison-title" className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-background p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Verified suppliers</p>
                <h2 id="price-comparison-title" className="mt-1 text-xl font-semibold">Compare manufacturer offers</h2>
                <p className="mt-1 text-sm text-muted-foreground">{product.genericName} · {product.strength} · {product.dosageForm}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid size-10 shrink-0 place-items-center rounded-lg hover:bg-muted" aria-label="Close price comparison">
                <X className="size-5" />
              </button>
            </div>

            <form className="mt-5 flex items-end gap-3" onSubmit={(event) => { event.preventDefault(); void loadOffers() }}>
              <label className="flex-1 text-sm font-medium">
                Quantity
                <Input className="mt-1 h-11" type="number" min={1} max={100000} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} />
              </label>
              <Button type="submit" className="min-h-11" disabled={loading}>{loading ? "Comparing..." : "Update comparison"}</Button>
            </form>

            {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
            {loading ? <div className="mt-5 h-32 animate-pulse rounded-lg bg-muted" /> : offers.length ? (
              <div className="mt-5 overflow-hidden rounded-lg border border-border">
                <div className="grid grid-cols-[1.2fr_0.9fr_0.8fr_0.8fr] gap-2 bg-muted/60 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
                  <span>Manufacturer</span><span>PTR after scheme</span><span>Incl. GST / unit</span><span>Availability</span>
                </div>
                {offers.map((offer, index) => (
                  <div key={offer.id} className={`grid grid-cols-[1.2fr_0.9fr_0.8fr_0.8fr] items-center gap-2 border-t border-border px-3 py-3 text-sm ${index === 0 ? "bg-emerald-50/70 dark:bg-emerald-950/20" : ""}`}>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{offer.manufacturer}</p>
                      <p className="truncate text-xs text-muted-foreground">{offer.name} · MOQ {offer.minOrderQty}</p>
                      {offer.schemeName ? <p className="truncate text-xs text-emerald-700 dark:text-emerald-400">{offer.schemeName}: {offer.discountPercent}% off</p> : null}
                    </div>
                    <span className="number">₹{offer.ptrAfterScheme.toFixed(2)}</span>
                    <span className="number font-semibold">₹{offer.estimatedUnitIncludingGst.toFixed(2)}</span>
                    <span className="text-xs">{offer.availability}<span className="block text-muted-foreground">{offer.stock.toLocaleString()} units</span></span>
                  </div>
                ))}
              </div>
            ) : !error ? (
              <div className="mt-5 rounded-lg bg-muted/60 p-6 text-center text-sm text-muted-foreground">
                <FileText className="mx-auto mb-2 size-6" />
                No equivalent offers are available from your verified manufacturers.
              </div>
            ) : null}

            {offers.some((offer) => !offer.meetsMoq) ? <p className="mt-3 text-xs text-muted-foreground">The selected quantity is below the MOQ for one or more offers. Scheme and price estimates use your selected quantity.</p> : null}
          </section>
        </div>
      ) : null}
    </>
  )
}