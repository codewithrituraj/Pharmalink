import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { notify } from "@/lib/notifications"
import { canTransition } from "@/lib/orders"
import { requireRole } from "@/lib/access"
import { recordOrderDelivery } from "@/lib/delivery"

const schema = z.object({
  status: z.enum(["CONFIRMED", "APPROVED", "PACKED", "SHIPPED", "DISPATCHED", "DELIVERED", "REJECTED"]),
  transporter: z.string().trim().min(2).max(100).optional(), trackingNumber: z.string().trim().min(2).max(100).optional(),
  expectedDelivery: z.string().datetime().optional(), partialFulfilment: z.boolean().optional(),
})
const canonical = (status: string) => status === "CONFIRMED" ? "APPROVED" : status === "SHIPPED" ? "DISPATCHED" : status
const label = (status: string) => status === "APPROVED" ? "confirmed" : status === "DISPATCHED" ? "shipped" : status.toLowerCase()

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("MANUFACTURER", true); if ("error" in auth) return auth.error
  const parsed = schema.safeParse(await req.json()); if (!parsed.success) return NextResponse.json({ error: "Invalid lifecycle update", details: parsed.error.flatten() }, { status: 400 })
  const next = canonical(parsed.data.status); const { id } = await params
  const order = await prisma.order.findFirst({ where: { id, sellerId: auth.session.user.organizationId! }, include: { items: { include: { product: true, allocations: { include: { batch: true } } } } } })
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
  if (!canTransition(order.status, next)) return NextResponse.json({ error: `Cannot move ${order.status} to ${next}` }, { status: 409 })
  if (next === "APPROVED") {
    const shortages = order.items.map((item) => ({ product: item.product.name, requested: item.quantity, allocated: item.allocations.reduce((sum, a) => sum + a.quantity, 0) })).filter((line) => line.allocated < line.requested)
    if (shortages.length && !parsed.data.partialFulfilment) return NextResponse.json({ error: "Insufficient availability; confirm partial fulfilment to continue", shortages }, { status: 409 })
  }
  if (next === "DISPATCHED" && (!parsed.data.transporter || !parsed.data.trackingNumber)) return NextResponse.json({ error: "Transporter and tracking number are required to ship" }, { status: 400 })
  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.order.update({ where: { id }, data: { status: next, ...(next === "APPROVED" ? { invoiceNumber: order.invoiceNumber ?? `INV-${new Date().getFullYear()}-${order.id.slice(-7).toUpperCase()}`, invoiceCreatedAt: order.invoiceCreatedAt ?? new Date() } : {}), ...(next === "DISPATCHED" ? { transporter: parsed.data.transporter, trackingNumber: parsed.data.trackingNumber, expectedDelivery: parsed.data.expectedDelivery ? new Date(parsed.data.expectedDelivery) : new Date(Date.now() + 3 * 86_400_000) } : {}), audits: { create: { status: next, note: `Manufacturer marked order ${label(next)}${parsed.data.partialFulfilment ? " (partial fulfilment accepted)" : ""}` } } } })
    if (next === "DELIVERED") await recordOrderDelivery(tx, order)
    if (next === "REJECTED") for (const item of order.items) for (const allocation of item.allocations) await tx.batch.update({ where: { id: allocation.batchId }, data: { quantity: { increment: allocation.quantity } } })
    await notify(tx, { organizationId: order.buyerId, type: next === "APPROVED" ? "INVOICE_READY" : "ORDER_STATUS", severity: next === "REJECTED" ? "WARNING" : "INFO", title: next === "APPROVED" ? "Invoice ready" : `Order ${label(next)}`, message: next === "DISPATCHED" ? `Tracking ${parsed.data.trackingNumber} via ${parsed.data.transporter}.` : `Your order is ${label(next)}.`, link: next === "DELIVERED" ? "/stockist/inventory" : `/stockist/orders/${order.id}` })
    return saved
  })
  return NextResponse.json({ success: true, order: updated })
}
