"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  FileCheck,
  FileText,
  Package,
  PackageCheck,
  RefreshCw,
  Sparkles,
  Truck,
  XCircle,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { ShareWhatsAppButton } from "@/components/share-whatsapp-button"

export type OrderDetail = {
  id: string
  poNumber: string | null
  status: string
  total: number
  subtotal: number
  discount: number
  gst: number
  isPaid?: boolean
  notes: string | null
  transporter: string | null
  trackingNumber: string | null
  expectedDelivery: string | null
  invoiceNumber: string | null
  invoiceCreatedAt: string | null
  createdAt: string
  seller: {
    name: string
    address?: string | null
    drugLicense?: string | null
    gstNumber?: string | null
  }
  buyer?: {
    name: string
    address?: string | null
    drugLicense?: string | null
    gstNumber?: string | null
  }
  items: {
    id: string
    quantity: number
    freeQuantity?: number
    price: number
    product: {
      id: string
      name: string
      genericName: string
      packSize: string
      mrp?: number
      ptr?: number
      availability?: number
    }
    allocations?: {
      id: string
      quantity: number
      batch: {
        batchNumber: string
        expiryDate: string
      }
    }[]
  }[]
  audits: { id: string; status: string; note: string | null; createdAt: string }[]
}

const TIMELINE_STEPS = [
  { key: "PLACED", label: "Placed", icon: Clock },
  { key: "APPROVED", label: "Confirmed", icon: CheckCircle2 },
  { key: "PACKED", label: "Packed", icon: Package },
  { key: "DISPATCHED", label: "Shipped", icon: Truck },
  { key: "DELIVERED", label: "Delivered", icon: PackageCheck },
]

type LiveProduct = {
  id: string
  name: string
  ptr: number
  totalStock: number
}

type ReorderCartItem = { product: LiveProduct; quantity: number }

function statusBadgeVariant(status: string) {
  switch (status) {
    case "DELIVERED":
      return "default"
    case "DISPATCHED":
    case "PACKED":
    case "APPROVED":
      return "secondary"
    case "REJECTED":
    case "CANCELLED":
      return "destructive"
    default:
      return "outline"
  }
}

export function OrderDetail({ initialOrder }: { initialOrder: OrderDetail }) {
  const router = useRouter()
  const { toast } = useToast()
  const [order, setOrder] = useState<OrderDetail>(initialOrder)
  const [cancelling, setCancelling] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [reordering, setReordering] = useState(false)
  const [diffModal, setDiffModal] = useState<{
    open: boolean
    changes: { name: string; oldPrice: number; newPrice: number; available: number }[]
  }>({ open: false, changes: [] })

  const currentStepIndex = TIMELINE_STEPS.findIndex((s) => s.key === order.status)
  const isTerminalFailure = ["REJECTED", "CANCELLED"].includes(order.status)
  const isCancellable = ["PLACED", "APPROVED"].includes(order.status)

  async function handleCancel() {
    if (!confirm("Are you sure you want to cancel this purchase order? Allocated inventory will be released.")) {
      return
    }
    setCancelling(true)
    try {
      const res = await fetch(`/api/stockist/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CANCEL" }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Cancel failed",
          description: data?.error || "Order could not be cancelled.",
        })
        return
      }
      setOrder((prev) => ({
        ...prev,
        status: "CANCELLED",
        audits: [
          ...prev.audits,
          {
            id: crypto.randomUUID(),
            status: "CANCELLED",
            note: "Cancelled by stockist",
            createdAt: new Date().toISOString(),
          },
        ],
      }))
      toast({
        title: "Order cancelled",
        description: "Your purchase order was cancelled and inventory has been released.",
      })
    } catch {
      toast({
        variant: "destructive",
        title: "Network error",
        description: "Please check your connection and try again.",
      })
    } finally {
      setCancelling(false)
    }
  }

  async function handleSimulateNext() {
    setAdvancing(true)
    try {
      const res = await fetch(`/api/stockist/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SIMULATE_NEXT" }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Simulation update failed",
          description: data?.error || "Could not advance status.",
        })
        return
      }

      // Re-fetch full updated order
      const fullRes = await fetch(`/api/stockist/orders/${order.id}`)
      if (fullRes.ok) {
        const fullData = await fullRes.json()
        setOrder(fullData)
      } else if (data.order) {
        setOrder((prev) => ({
          ...prev,
          status: data.order.status,
          invoiceNumber: data.order.invoiceNumber ?? prev.invoiceNumber,
          transporter: data.order.transporter ?? prev.transporter,
          trackingNumber: data.order.trackingNumber ?? prev.trackingNumber,
        }))
      }

      toast({
        title: "Status advanced",
        description: `Order successfully advanced to ${data.order?.status || "next stage"}.`,
      })
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not advance status.",
      })
    } finally {
      setAdvancing(false)
    }
  }

  async function handleReorder(singleItemId?: string) {
    setReordering(true)
    try {
      const itemsToReorder = singleItemId
        ? order.items.filter((i) => i.id === singleItemId)
        : order.items

      // Fetch live product details to check price changes and availability
      const priceChanges: { name: string; oldPrice: number; newPrice: number; available: number }[] = []
      const cartItemsToAdd: ReorderCartItem[] = []

      for (const item of itemsToReorder) {
        const pRes = await fetch(`/api/stockist/products/${item.product.id}`)
        if (pRes.ok) {
          const liveProduct = (await pRes.json()) as LiveProduct
          if (liveProduct.ptr !== item.price) {
            priceChanges.push({
              name: item.product.name,
              oldPrice: item.price,
              newPrice: liveProduct.ptr,
              available: liveProduct.totalStock,
            })
          }
          cartItemsToAdd.push({
            product: liveProduct,
            quantity: item.quantity,
          })
        }
      }

      if (priceChanges.length > 0) {
        setDiffModal({ open: true, changes: priceChanges })
      }

      // Add to session storage cart
      const existingCartStr = sessionStorage.getItem("pharmalink-cart")
      const currentCart: ReorderCartItem[] = existingCartStr ? JSON.parse(existingCartStr) as ReorderCartItem[] : []

      for (const toAdd of cartItemsToAdd) {
        const existingIdx = currentCart.findIndex((c) => c.product.id === toAdd.product.id)
        if (existingIdx >= 0) {
          currentCart[existingIdx].quantity += toAdd.quantity
        } else {
          currentCart.push(toAdd)
        }
      }

      sessionStorage.setItem("pharmalink-cart", JSON.stringify(currentCart))
      toast({
        title: "Items added to cart",
        description: `${itemsToReorder.length} item(s) added to your procurement cart.`,
      })

      if (priceChanges.length === 0) {
        router.push("/stockist/catalogue")
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Reorder failed",
        description: "Could not verify live medicine pricing.",
      })
    } finally {
      setReordering(false)
    }
  }

  function copyTracking() {
    if (order.trackingNumber) {
      navigator.clipboard.writeText(order.trackingNumber)
      toast({ title: "Tracking copied", description: order.trackingNumber })
    }
  }

  const nextSimulationLabel =
    order.status === "PLACED"
      ? "Simulate: Confirm Order"
      : order.status === "APPROVED"
        ? "Simulate: Pack Order"
        : order.status === "PACKED"
          ? "Simulate: Ship Order"
          : order.status === "DISPATCHED"
            ? "Simulate: Mark Delivered"
            : null

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <button
        type="button"
        onClick={() => router.push("/stockist/orders")}
        className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to orders
      </button>

      {/* Header Bar */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="flex items-center gap-2">
            <p className="eyebrow">Purchase Order Tracking</p>
            {order.isPaid ? (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                Paid
              </span>
            ) : (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                Ledger Outstanding
              </span>
            )}
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            {order.poNumber ?? `PO-${order.id.slice(-8).toUpperCase()}`}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manufacturer: <strong className="font-semibold text-foreground">{order.seller.name}</strong> · Placed on{" "}
            {new Date(order.createdAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusBadgeVariant(order.status)} className="min-h-9 px-3 text-xs font-semibold">
            {order.status === "APPROVED"
              ? "CONFIRMED"
              : order.status === "DISPATCHED"
                ? "SHIPPED"
                : order.status}
          </Badge>

          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => window.open(`/api/stockist/orders/${order.id}/pdf`, "_blank")}
          >
            <Download className="size-4" /> Download PO PDF
          </Button>

          <Button
            variant="default"
            className="min-h-11"
            onClick={() => window.open(`/api/stockist/orders/${order.id}/pdf?type=invoice`, "_blank")}
          >
            <FileText className="size-4" /> Download Tax Invoice
          </Button>
          <ShareWhatsAppButton message={`PharmaLink purchase order ${order.poNumber ?? order.id} with ${order.seller.name} · ₹${order.total.toFixed(2)} · ${order.status}`} path={`/stockist/orders/${order.id}`} />
        </div>
      </div>

      {/* Dev / Demo status simulator bar */}
      {nextSimulationLabel && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm text-primary">
          <div className="flex items-center gap-2 font-medium">
            <Sparkles className="size-4 text-primary" />
            <span>Workflow Simulation: Test the manufacturer fulfilment pipeline live</span>
          </div>
          <Button
            size="sm"
            variant="default"
            disabled={advancing}
            onClick={handleSimulateNext}
            className="h-9 px-4 font-semibold"
          >
            {advancing ? "Advancing..." : nextSimulationLabel}
          </Button>
        </div>
      )}

      {/* Timeline Progression */}
      <Card className="surface-card border-0">
        <CardContent className="overflow-x-auto p-6">
          <div className="flex min-w-[34rem] items-start justify-between">
            {TIMELINE_STEPS.map((step, index) => {
              const Icon = step.icon
              const isPastOrCurrent = !isTerminalFailure && index <= currentStepIndex
              const isCurrent = !isTerminalFailure && index === currentStepIndex

              return (
                <div key={step.key} className="relative flex flex-1 flex-col items-center text-center">
                  <div
                    className={`z-10 grid size-10 place-items-center rounded-full border-2 transition-all ${
                      isCurrent
                        ? "border-primary bg-primary text-primary-foreground shadow-md ring-4 ring-primary/20"
                        : isPastOrCurrent
                          ? "border-primary bg-primary/20 text-primary"
                          : "border-border bg-background text-muted-foreground"
                    }`}
                  >
                    <Icon className="size-5" />
                  </div>

                  {index < TIMELINE_STEPS.length - 1 && (
                    <div
                      className={`absolute left-1/2 top-5 h-0.5 w-full ${
                        !isTerminalFailure && index < currentStepIndex ? "bg-primary" : "bg-border"
                      }`}
                    />
                  )}

                  <p
                    className={`mt-3 text-xs font-semibold ${
                      isCurrent ? "text-primary" : isPastOrCurrent ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Rejection / Cancellation Callout */}
      {isTerminalFailure && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          <XCircle className="size-5 shrink-0" />
          <span>
            This purchase order is <strong>{order.status.toLowerCase()}</strong>. Any allocated batch stock has been
            returned to the manufacturer inventory.
          </span>
        </div>
      )}

      {/* Prominent Dispatch & Delivery ETA Banner */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="surface-card border-0">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Estimated Delivery
            </CardTitle>
            <Calendar className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-foreground">
              {order.expectedDelivery
                ? new Date(order.expectedDelivery).toLocaleDateString("en-IN", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : order.status === "DELIVERED"
                  ? "Delivered to warehouse"
                  : "Scheduled upon dispatch"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {order.status === "DELIVERED"
                ? "Full shipment received & inspected"
                : order.status === "DISPATCHED"
                  ? "In transit with logistics carrier"
                  : "Awaiting fulfillment confirmation"}
            </p>
          </CardContent>
        </Card>

        <Card className="surface-card border-0">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Logistics & Carrier
            </CardTitle>
            <Truck className="size-4 text-sky-600" />
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-foreground">{order.transporter || "PharmaLink Logistics"}</p>
            {order.trackingNumber ? (
              <div className="mt-1 flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{order.trackingNumber}</span>
                <button
                  type="button"
                  onClick={copyTracking}
                  className="rounded p-0.5 hover:bg-muted"
                  title="Copy tracking number"
                >
                  <Copy className="size-3 text-muted-foreground" />
                </button>
              </div>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">Docket ID will be generated upon dispatch</p>
            )}
          </CardContent>
        </Card>

        <Card className="surface-card border-0">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Tax Invoice
            </CardTitle>
            <FileCheck className="size-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-foreground">
              {order.invoiceNumber ? (
                <Link href={`/stockist/invoices`} className="text-primary hover:underline">
                  {order.invoiceNumber}
                </Link>
              ) : (
                <span className="text-muted-foreground">Generated on confirmation</span>
              )}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {order.invoiceCreatedAt
                ? `Dated ${new Date(order.invoiceCreatedAt).toLocaleDateString("en-IN")}`
                : "GST compliant tax invoice"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Line Items & Audits Grid */}
      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        {/* Ordered Medicines Table */}
        <Card className="surface-card border-0">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Ordered Items</CardTitle>
              <p className="text-xs text-muted-foreground">
                Batch allocations were made by earliest expiry first (FEFO).
              </p>
            </div>
            <span className="text-xs font-semibold text-muted-foreground">{order.items.length} product(s)</span>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="divide-y divide-border/60">
              {order.items.map((item) => {
                const lineTotal = item.price * item.quantity

                return (
                  <div key={item.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">{item.product.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {item.product.genericName} · {item.product.packSize}
                        </p>
                        {/* Batches Allocated */}
                        {item.allocations && item.allocations.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {item.allocations.map((alloc) => (
                              <span
                                key={alloc.id}
                                className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-[0.7rem] text-secondary-foreground"
                              >
                                <span className="font-mono font-medium">{alloc.batch.batchNumber}</span>
                                <span className="text-muted-foreground">
                                  (Exp {new Date(alloc.batch.expiryDate).toLocaleDateString("en-IN", { month: "short", year: "2-digit" })})
                                </span>
                                <strong className="font-semibold">{alloc.quantity}u</strong>
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="text-right">
                        <p className="number text-base font-bold">₹{lineTotal.toFixed(2)}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {item.quantity} units @ ₹{item.price.toFixed(2)}
                          {item.freeQuantity ? (
                            <span className="ml-1 font-semibold text-emerald-600">
                              (+{item.freeQuantity} free bonus)
                            </span>
                          ) : null}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-1 h-7 px-2 text-xs text-primary"
                          onClick={() => handleReorder(item.id)}
                        >
                          <RefreshCw className="mr-1 size-3" /> Reorder this item
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Subtotals & Taxes */}
            <div className="space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Gross Subtotal</span>
                <span className="number font-medium text-foreground">₹{order.subtotal.toFixed(2)}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                  <span>Trade Scheme Discount</span>
                  <span className="number font-medium">-₹{order.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>Taxable Amount</span>
                <span className="number font-medium text-foreground">
                  ₹{(order.subtotal - order.discount).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>GST (Goods & Services Tax)</span>
                <span className="number font-medium text-foreground">₹{order.gst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-bold text-foreground">
                <span>Grand Total</span>
                <span className="number text-lg text-primary">₹{order.total.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sidebar Info (Delivery & Audit) */}
        <div className="space-y-6">
          <Card className="surface-card border-0">
            <CardHeader>
              <CardTitle>Delivery Addresses</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Seller Details</p>
                <p className="font-semibold text-foreground">{order.seller.name}</p>
                <p className="text-xs text-muted-foreground">{order.seller.address || "Industrial Area"}</p>
                <p className="text-xs text-muted-foreground">
                  GSTIN: {order.seller.gstNumber || "N/A"} · DL: {order.seller.drugLicense || "N/A"}
                </p>
              </div>

              {order.buyer && (
                <div className="border-t border-border/70 pt-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Recipient Stockist</p>
                  <p className="font-semibold text-foreground">{order.buyer.name}</p>
                  <p className="text-xs text-muted-foreground">{order.buyer.address || "Delivery Warehouse"}</p>
                  <p className="text-xs text-muted-foreground">
                    GSTIN: {order.buyer.gstNumber || "N/A"} · DL: {order.buyer.drugLicense || "N/A"}
                  </p>
                </div>
              )}

              {order.notes && (
                <div className="border-t border-border/70 pt-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Order Notes</p>
                  <p className="text-xs text-foreground">{order.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Audit History */}
          <Card className="surface-card border-0">
            <CardHeader>
              <CardTitle>Audit & Fulfillment Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.audits.map((audit) => (
                <div key={audit.id} className="flex gap-3 text-sm">
                  <div className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                  <div>
                    <p className="font-medium text-foreground">{audit.status}</p>
                    <p className="text-xs text-muted-foreground">
                      {audit.note} · {new Date(audit.createdAt).toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
        <div className="flex flex-wrap gap-2">
          {isCancellable && (
            <Button
              variant="destructive"
              className="min-h-11"
              disabled={cancelling}
              onClick={handleCancel}
            >
              <XCircle className="size-4" /> {cancelling ? "Cancelling..." : "Cancel Purchase Order"}
            </Button>
          )}

          <Button
            variant="outline"
            className="min-h-11"
            disabled={reordering}
            onClick={() => handleReorder()}
          >
            <RefreshCw className={`size-4 ${reordering ? "animate-spin" : ""}`} />{" "}
            {reordering ? "Checking prices..." : "Reorder All Items"}
          </Button>
        </div>

        <Link
          href="/stockist/invoices"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          <FileText className="size-4" /> View in Invoices & Billing →
        </Link>
      </div>

      {/* Price Difference Modal */}
      {diffModal.open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-background p-6 shadow-2xl">
            <p className="eyebrow">Price & Availability Notice</p>
            <h3 className="mt-1 text-xl font-semibold">Prices updated since your last order</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Some items have changed prices or current stock levels. Items were added to your cart at today&apos;s
              current rates:
            </p>

            <div className="mt-4 max-h-60 divide-y divide-border overflow-y-auto rounded-xl border border-border p-3">
              {diffModal.changes.map((change, i) => (
                <div key={i} className="py-2 text-sm first:pt-0 last:pb-0">
                  <p className="font-semibold">{change.name}</p>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Previous: <span className="line-through">₹{change.oldPrice.toFixed(2)}</span> ➔ Current:{" "}
                      <strong className="text-primary">₹{change.newPrice.toFixed(2)}</strong>
                    </span>
                    <span>{change.available} in stock</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="default"
                className="min-h-11"
                onClick={() => {
                  setDiffModal({ open: false, changes: [] })
                  router.push("/stockist/catalogue")
                }}
              >
                Proceed to Cart & Catalogue
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
