"use client"

import { useMemo, useState } from "react"
import {
  BadgeCheck,
  Boxes,
  CalendarClock,
  Factory,
  Layers,
  PencilLine,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { CardSkeleton, StatSkeleton } from "@/components/skeletons"
import { BarList } from "@/components/charts/bar-list"
import { BarChart, type BarChartPoint } from "@/components/charts/bar-chart"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { useApiResource } from "@/hooks/use-api-resource"
import { cn } from "@/lib/utils"
import { ImportListButton } from "@/components/stockist/import-list-button"
import { BarcodeScanner } from "@/components/stockist/barcode-scanner"
import { ColdChainButton } from "@/components/stockist/cold-chain-button"

type ProductOption = { id: string; name: string; brand: string; strength: string; packSize: string; minOrderQty: number }
type BatchRow = {
  id: string
  productId: string
  productName: string
  brand: string
  strength: string
  packSize: string
  batchNumber: string
  quantity: number
  mfgDate: string | null
  expiryDate: string | null
  sourceOrderId: string | null
  receivedAt: string
}
type InventoryPayload = {
  serverTime: string
  batches: BatchRow[]
  products: ProductOption[]
  summary: {
    totalBatches: number
    totalUnits: number
    expiringSoon: number
    expired: number
    stockoutRisk: number
  }
  daysCover: { bucket: string; units: number }[]
  topProducts: { key: string; label: string; value: number; detail: string }[]
}

function daysUntil(now: number, date: string | null) {
  if (!date) return null
  return Math.ceil((new Date(date).getTime() - now) / 86_400_000)
}

function expiryTone(now: number, date: string | null) {
  const days = daysUntil(now, date)
  if (days === null) return { label: "No expiry", variant: "outline" as const }
  if (days < 0) return { label: `Expired ${Math.abs(days)}d ago`, variant: "destructive" as const }
  if (days <= 30) return { label: `${days}d left`, variant: "destructive" as const }
  if (days <= 90) return { label: `${days}d left`, variant: "warning" as const }
  return { label: `${days}d left`, variant: "success" as const }
}

export default function InventoryPage() {
  const { toast } = useToast()
  const { data, error, loading, refresh } = useApiResource<InventoryPayload>("/api/stockist/inventory")
  const [search, setSearch] = useState("")
  const [stockFilter, setStockFilter] = useState<"ALL" | "OK" | "LOW" | "EXPIRED">("ALL")
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<BatchRow | null>(null)
  const [form, setForm] = useState({ productId: "", batchNumber: "", quantity: "", mfgDate: "", expiryDate: "" })

  const batches = useMemo(() => data?.batches ?? [], [data?.batches])
  // Derived from the server clock so day counts stay stable across renders.
  const serverTime = data?.serverTime
  const now = useMemo(
    () => (serverTime ? new Date(serverTime).getTime() : 0),
    [serverTime],
  )

  const grouped = useMemo(() => {
    const totals = new Map<string, { name: string; brand: string; strength: string; packSize: string; quantity: number; earliest: number | null; batches: BatchRow[] }>()
    for (const batch of batches) {
      const days = daysUntil(now, batch.expiryDate)
      const entry = totals.get(batch.productId) ?? {
        name: batch.productName,
        brand: batch.brand,
        strength: batch.strength,
        packSize: batch.packSize,
        quantity: 0,
        earliest: null,
        batches: [],
      }
      entry.quantity += batch.quantity
      entry.batches.push(batch)
      if (days !== null && (entry.earliest === null || days < entry.earliest)) entry.earliest = days
      totals.set(batch.productId, entry)
    }
    return [...totals.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name))
  }, [batches, now])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return grouped.filter(([, entry]) => {
      if (term && !`${entry.name} ${entry.brand} ${entry.strength} ${entry.packSize}`.toLowerCase().includes(term)) {
        return false
      }
      if (stockFilter === "EXPIRED") return entry.earliest !== null && entry.earliest < 0
      if (stockFilter === "LOW") return entry.earliest !== null && entry.earliest <= 90
      if (stockFilter === "OK") return entry.earliest === null || entry.earliest > 90
      return true
    })
  }, [grouped, search, stockFilter])

  const coverage = useMemo<BarChartPoint[]>(
    () =>
      (data?.daysCover ?? []).map((bucket) => ({
        key: bucket.bucket,
        label: bucket.bucket,
        value: bucket.units,
        detail: "Units expiring in this window",
      })),
    [data?.daysCover],
  )

  function openAdd() {
    setEditing(null)
    setForm({ productId: "", batchNumber: "", quantity: "", mfgDate: "", expiryDate: "" })
    setShowAdd(true)
  }

  function openEdit(batch: BatchRow) {
    setEditing(batch)
    setForm({
      productId: batch.productId,
      batchNumber: batch.batchNumber,
      quantity: String(batch.quantity),
      mfgDate: batch.mfgDate ? batch.mfgDate.slice(0, 10) : "",
      expiryDate: batch.expiryDate ? batch.expiryDate.slice(0, 10) : "",
    })
    setShowAdd(true)
  }

  async function save() {
    const payload = {
      productId: form.productId,
      batchNumber: form.batchNumber.trim(),
      quantity: Number(form.quantity),
      mfgDate: form.mfgDate || undefined,
      expiryDate: form.expiryDate || undefined,
    }
    if (!payload.productId || !payload.batchNumber || !payload.quantity || payload.quantity <= 0) {
      toast({ title: "Fill in product, batch number and quantity", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const response = await fetch(
        editing ? `/api/stockist/inventory/${editing.id}` : "/api/stockist/inventory",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      )
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? "Could not save batch")
      toast({ title: editing ? "Batch updated" : "Batch added to inventory" })
      setShowAdd(false)
      refresh()
    } catch (cause) {
      toast({ title: getMessage(cause), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function remove(batch: BatchRow) {
    if (!window.confirm(`Remove batch ${batch.batchNumber} (${batch.quantity} units)?`)) return
    setSaving(true)
    try {
      const response = await fetch(`/api/stockist/inventory/${batch.id}`, { method: "DELETE" })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? "Could not remove batch")
      toast({ title: "Batch removed" })
      refresh()
    } catch (cause) {
      toast({ title: getMessage(cause), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Batch stock"
        description="Every batch you hold, with real batch numbers and expiry dates taken from the manufacturer. Stock is received first-expiry-first-out, so the batch closest to expiry is always consumed first."
        actions={
          <div className="flex flex-wrap gap-2"><ImportListButton mode="inventory" onImported={refresh}/><Button className="min-h-11" onClick={openAdd} disabled={loading || !data?.products.length}><Plus className="size-4" /> Add batch</Button></div>
        }
      />

      {error ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-5">
            <p className="text-sm text-destructive">{error}</p>
            <Button size="sm" variant="outline" onClick={refresh}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <StatSkeleton />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={Layers}
            label="Active batches"
            value={String(data?.summary.totalBatches ?? 0)}
            hint="batch numbers on hand"
          />
          <MetricCard
            icon={Boxes}
            label="Units in stock"
            value={(data?.summary.totalUnits ?? 0).toLocaleString("en-IN")}
            hint="across all products"
          />
          <MetricCard
            icon={CalendarClock}
            label="Expiring in 90 days"
            value={String(data?.summary.expiringSoon ?? 0)}
            hint="batches need action"
            tone={(data?.summary.expiringSoon ?? 0) > 0 ? "warning" : "ok"}
          />
          <MetricCard
            icon={TriangleAlert}
            label="Expired batches"
            value={String(data?.summary.expired ?? 0)}
            hint="must not be dispensed"
            tone={(data?.summary.expired ?? 0) > 0 ? "danger" : "ok"}
          />
        </div>
      )}

      {loading ? (
        <CardSkeleton />
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Stock value concentration</CardTitle>
              <CardDescription>
                Units by product, so you can see which lines are carrying your working capital.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BarList
                items={data?.topProducts ?? []}
                valueFormatter={(value) => `${value.toLocaleString("en-IN")} units`}
                emptyMessage="Add your first batch to see stock concentration."
                barClassName="bg-primary"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Expiry exposure</CardTitle>
              <CardDescription>Units expiring within each window.</CardDescription>
            </CardHeader>
            <CardContent>
              {coverage.length ? (
                <BarChart
                  data={coverage}
                  height={200}
                  ariaLabel="Units expiring in the next 30, 60 and 90 days"
                  primaryLabel="Units"
                />
              ) : (
                <EmptyState
                  icon={BadgeCheck}
                  title="Nothing expiring soon"
                  description="No batch in your inventory expires in the next 90 days."
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {loading ? (
        <CardSkeleton />
      ) : (
        <Card>
          <CardHeader className="gap-4">
            <div>
              <CardTitle>Batch ledger</CardTitle>
              <CardDescription>
                {grouped.length} product{grouped.length === 1 ? "" : "s"} ·{" "}
                {batches.length} batch{batches.length === 1 ? "" : "es"}
              </CardDescription>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search product or brand"
                  className="pl-9"
                  aria-label="Search inventory"
                />
              </div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter inventory">
                {(["ALL", "OK", "LOW", "EXPIRED"] as const).map((filter) => (
                  <Button
                    key={filter}
                    size="sm"
                    variant={stockFilter === filter ? "default" : "outline"}
                    onClick={() => setStockFilter(filter)}
                    className="h-8"
                  >
                    {filter === "ALL" ? "All" : filter === "OK" ? "Healthy" : filter === "LOW" ? "≤ 90d" : "Expired"}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {filtered.length === 0 ? (
              <EmptyState
                icon={Boxes}
                title={grouped.length ? "No products match" : "No stock yet"}
                description={
                  grouped.length
                    ? "Try a different search term or filter."
                    : "Batches appear here automatically when a manufacturer delivers your order. You can also add one manually if you already hold stock."
                }
                action={
                  !grouped.length ? (
                    <Button onClick={openAdd} disabled={!data?.products.length}>
                      <Plus className="size-4" /> Add batch
                    </Button>
                  ) : null
                }
                className="rounded-none border-0"
              />
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map(([productId, entry]) => {
                  const tone = expiryTone(
                    now,
                    entry.earliest === null
                      ? null
                      : new Date(now + entry.earliest * 86_400_000).toISOString(),
                  )
                  return (
                    <li key={productId} className="px-5 py-4 sm:px-6">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{entry.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {entry.brand} · {entry.strength} · {entry.packSize}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={tone.variant}>{tone.label}</Badge>
                          <span className="number text-sm font-semibold">
                            {entry.quantity.toLocaleString("en-IN")} units
                          </span>
                        </div>
                      </div>

                      <ul className="mt-3 space-y-2">
                        {entry.batches.map((batch) => {
                          const batchTone = expiryTone(now, batch.expiryDate)
                          return (
                            <li
                              key={batch.id}
                              className="flex flex-col gap-2 rounded-xl bg-muted/50 px-3 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span className="font-medium">Batch {batch.batchNumber}</span>
                                <span className="number">{batch.quantity} units</span>
                                {batch.expiryDate ? (
                                  <span className="text-muted-foreground">
                                    Exp {new Date(batch.expiryDate).toLocaleDateString("en-IN")}
                                  </span>
                                ) : null}
                                {batch.sourceOrderId ? (
                                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                                    <Factory className="size-3" /> Delivered
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">Added manually</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Badge variant={batchTone.variant}>{batchTone.label}</Badge>
                                <ColdChainButton batchId={batch.id} batchNumber={batch.batchNumber} />
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  aria-label={`Edit batch ${batch.batchNumber}`}
                                  onClick={() => openEdit(batch)}
                                >
                                  <PencilLine className="size-3.5" />
                                </Button>
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  aria-label={`Remove batch ${batch.batchNumber}`}
                                  onClick={() => remove(batch)}
                                >
                                  <Trash2 className="size-3.5 text-destructive" />
                                </Button>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {showAdd ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={editing ? "Edit batch" : "Add batch"}
          onClick={(event) => {
            if (event.target === event.currentTarget) setShowAdd(false)
          }}
        >
          <Card className="w-full max-w-lg rounded-b-none sm:rounded-2xl">
            <CardHeader>
              <CardTitle>{editing ? `Edit batch ${editing.batchNumber}` : "Add a batch"}</CardTitle>
              <CardDescription>
                Use the batch number printed on the carton. Expiry is optional but unlocks expiry alerts
                and FEFO ordering.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="product">Product</Label>
                <select
                  id="product"
                  value={form.productId}
                  disabled={Boolean(editing)}
                  onChange={(event) => setForm({ ...form, productId: event.target.value })}
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm disabled:opacity-60"
                >
                  <option value="">Select a product</option>
                  {(data?.products ?? []).map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} — {product.strength} ({product.packSize})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="batch">Batch number</Label>
                  <Input
                    id="batch"
                    value={form.batchNumber}
                    onChange={(event) => setForm({ ...form, batchNumber: event.target.value })}
                    placeholder="e.g. AMX-2291"
                  />
                  {!editing ? <BarcodeScanner onDetected={(value) => setForm((current) => ({ ...current, batchNumber: value }))} /> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min={1}
                    value={form.quantity}
                    onChange={(event) => setForm({ ...form, quantity: event.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="mfg">Manufacture date</Label>
                  <Input
                    id="mfg"
                    type="date"
                    value={form.mfgDate}
                    onChange={(event) => setForm({ ...form, mfgDate: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiry">Expiry date</Label>
                  <Input
                    id="expiry"
                    type="date"
                    value={form.expiryDate}
                    onChange={(event) => setForm({ ...form, expiryDate: event.target.value })}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={() => setShowAdd(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={save} disabled={saving || !data?.products.length}>
                  {saving ? "Saving…" : editing ? "Save changes" : "Add batch"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  )
}

function getMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : "Something went wrong"
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "ok",
}: {
  icon: typeof Layers
  label: string
  value: string
  hint: string
  tone?: "ok" | "warning" | "danger"
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="number mt-3 text-2xl font-semibold">{value}</p>
      <p className={cn("mt-1 text-xs", tone === "ok" ? "text-muted-foreground" : tone === "warning" ? "text-amber-600 dark:text-amber-400" : "text-destructive")}>
        {hint}
      </p>
    </div>
  )
}
