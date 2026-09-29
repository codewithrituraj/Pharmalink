"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Check, Download, PackageCheck, RefreshCw, Truck, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"

export type OrderDetail = {
  id: string
  poNumber: string | null
  status: string
  total: number
  subtotal: number
  discount: number
  gst: number
  notes: string | null
  transporter: string | null
  trackingNumber: string | null
  invoiceNumber: string | null
  createdAt: string
  seller: { name: string }
  items: { quantity: number; price: number; product: { name: string; genericName: string; packSize: string } }[]
  audits: { id: string; status: string; note: string | null; createdAt: string }[]
}

const steps = ["PLACED", "APPROVED", "PACKED", "DISPATCHED", "DELIVERED"]
function statusVariant(status: string) { return status === "DELIVERED" ? "default" : status === "REJECTED" || status === "CANCELLED" ? "destructive" : "outline" }

/**
 * The order detail, given the order.
 *
 * This used to fetch the order itself and trust the response. A request for an
 * order that does not exist answers 404 with an error object, which is still a
 * value, so the page stored that object as the order and then read
 * `order.seller.name` off it and threw. The not-found branch below could not
 * ever be reached, because the thing that was supposed to trigger it was
 * truthy.
 *
 * The page now reads the order on the server, scoped to the buying
 * organization, and decides there whether it exists. What arrives here is either
 * a real order or the not-found card, so there is no shape to guess at.
 */
export function OrderDetail({ initialOrder }: { initialOrder: OrderDetail }) {
  const router = useRouter()
  const { toast } = useToast()
  const [order, setOrder] = useState<OrderDetail>(initialOrder)

  async function action(type: "CANCEL" | "REORDER") {
    const response = await fetch(`/api/stockist/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: type }),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok) {
      toast({
        variant: "destructive",
        title: "Action unavailable",
        description: data?.error ?? "The order could not be updated.",
      })
      return
    }
    if (type === "REORDER") {
      sessionStorage.setItem("pharmalink-reorder", JSON.stringify(data))
      router.push("/stockist/catalogue")
      return
    }
    setOrder((current) => ({
      ...current,
      status: "CANCELLED",
      audits: [
        ...current.audits,
        {
          id: crypto.randomUUID(),
          status: "CANCELLED",
          note: "Cancelled by stockist",
          createdAt: new Date().toISOString(),
        },
      ],
    }))
    toast({ title: "Order cancelled", description: "Reserved stock has been released." })
  }

  const currentStep = steps.indexOf(order.status)
  return <div className="space-y-6"><button type="button" onClick={() => router.push("/stockist/orders")} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back to orders</button><div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="eyebrow">Order detail</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">{order.poNumber ?? order.id}</h2><p className="mt-2 text-muted-foreground">{order.seller.name} · placed {new Date(order.createdAt).toLocaleDateString()}</p></div><div className="flex flex-wrap gap-2"><Badge variant={statusVariant(order.status)} className="min-h-8 px-3">{order.status}</Badge><Button variant="outline" className="min-h-11" onClick={() => window.open(`/api/stockist/orders/${order.id}/pdf`, "_blank")}><Download className="size-4" /> PO PDF</Button><Button variant="outline" className="min-h-11" onClick={() => window.open(`/api/stockist/orders/${order.id}/pdf?type=invoice`, "_blank")}><Download className="size-4" /> Invoice</Button></div></div><Card className="surface-card border-0"><CardContent className="overflow-x-auto p-6"><div className="flex min-w-[34rem] items-start justify-between">{steps.map((step, index) => <div key={step} className="relative flex flex-1 flex-col items-center text-center"><div className={`z-10 grid size-10 place-items-center rounded-full border-2 ${index <= currentStep ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground"}`}>{index <= currentStep ? <Check className="size-4" /> : index === 2 ? <PackageCheck className="size-4" /> : index === 3 ? <Truck className="size-4" /> : <span className="text-xs">{index + 1}</span>}</div>{index < steps.length - 1 && <div className={`absolute left-1/2 top-5 h-0.5 w-full ${index < currentStep ? "bg-primary" : "bg-border"}`} />}<p className="mt-3 text-xs font-medium">{step}</p></div>)}</div></CardContent></Card>{["REJECTED", "CANCELLED"].includes(order.status) && <div className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive"><XCircle className="size-5" /> This order is {order.status.toLowerCase()}.</div>}<div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]"><Card className="surface-card border-0"><CardHeader><CardTitle>Line items</CardTitle></CardHeader><CardContent className="space-y-3">{order.items.map((item) => <div key={item.product.name} className="flex justify-between gap-4 rounded-xl border border-border/70 p-4"><div><p className="font-medium">{item.product.name}</p><p className="mt-1 text-xs text-muted-foreground">{item.product.genericName} · {item.product.packSize} · Qty {item.quantity}</p></div><span className="number font-semibold">₹{(item.price * item.quantity).toFixed(2)}</span></div>)}<div className="space-y-2 border-t border-border pt-4 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>₹{order.subtotal.toFixed(2)}</span></div><div className="flex justify-between text-emerald-700"><span>Discount</span><span>-₹{order.discount.toFixed(2)}</span></div><div className="flex justify-between"><span>GST</span><span>₹{order.gst.toFixed(2)}</span></div><div className="flex justify-between text-base font-semibold"><span>Total</span><span>₹{order.total.toFixed(2)}</span></div></div></CardContent></Card><div className="space-y-6"><Card className="surface-card border-0"><CardHeader><CardTitle>Delivery</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">{order.transporter ? <p><span className="text-muted-foreground">Transporter:</span> {order.transporter}</p> : <p className="text-muted-foreground">Transport details will appear when dispatched.</p>}{order.trackingNumber && <p><span className="text-muted-foreground">Tracking:</span> {order.trackingNumber}</p>}{order.invoiceNumber && <p><span className="text-muted-foreground">Invoice:</span> {order.invoiceNumber}</p>}{order.notes && <p><span className="text-muted-foreground">Notes:</span> {order.notes}</p>}</CardContent></Card><Card className="surface-card border-0"><CardHeader><CardTitle>Audit history</CardTitle></CardHeader><CardContent className="space-y-4">{order.audits.map((audit) => <div key={audit.id} className="flex gap-3 text-sm"><div className="mt-1 size-2 shrink-0 rounded-full bg-primary" /><div><p className="font-medium">{audit.status}</p><p className="text-xs text-muted-foreground">{audit.note} · {new Date(audit.createdAt).toLocaleString()}</p></div></div>)}</CardContent></Card></div></div><div className="flex flex-wrap gap-3">{["PLACED", "APPROVED"].includes(order.status) && <Button variant="destructive" className="min-h-11" onClick={() => action("CANCEL")}><XCircle className="size-4" /> Cancel order</Button>}<Button variant="outline" className="min-h-11" onClick={() => action("REORDER")}><RefreshCw className="size-4" /> Reorder items</Button></div></div>
}
