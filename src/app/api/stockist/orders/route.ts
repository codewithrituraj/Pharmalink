import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notify } from "@/lib/notifications"
import { allocateFefo, priceLines } from "@/lib/orders"

const orderSchema = z.object({
  manufacturerId: z.string().min(1),
  notes: z.string().trim().max(1000).optional().default(""),
  items: z.array(z.object({ productId: z.string().min(1), quantity: z.number().int().positive() })).min(1),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "STOCKIST" || !session.user.organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const orders = await prisma.order.findMany({ where: { buyerId: session.user.organizationId }, include: { seller: { select: { name: true } }, items: { include: { product: { select: { name: true, genericName: true } } } } }, orderBy: { createdAt: "desc" } })
  return NextResponse.json(orders)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "STOCKIST" || !session.user.organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const parsed = orderSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: "Invalid order data", details: parsed.error.flatten() }, { status: 400 })
  const { manufacturerId, items, notes } = parsed.data

  try {
    const result = await prisma.$transaction(async (tx) => {
      const grant = await tx.accessGrant.findFirst({ where: { manufacturerId, stockistId: session.user.organizationId, status: "VERIFIED" } })
      if (!grant) throw new Error("Unauthorized to order from this manufacturer")
      const products = await tx.product.findMany({ where: { id: { in: items.map((item) => item.productId) }, manufacturerId, isActive: true }, include: { schemes: { where: { validFrom: { lte: new Date() }, validUntil: { gte: new Date() } }, orderBy: { minQuantity: "desc" } }, batches: { where: { quantity: { gt: 0 } }, orderBy: { expiryDate: "asc" } } } })
      if (products.length !== items.length) throw new Error("One or more products are unavailable")

      // Pair each requested line with its catalogue product once, so the rules
      // below cannot disagree about which line they are working on.
      const lines = products.map((product) => {
        const item = items.find((candidate) => candidate.productId === product.id)
        if (!item) throw new Error("Product is unavailable")
        if (item.quantity < product.minOrderQty) {
          throw new Error(`${product.name} requires a minimum order of ${product.minOrderQty}`)
        }
        return { item, product }
      })

      const priced = priceLines(
        lines.map(({ item, product }) => ({
          quantity: item.quantity,
          unitPrice: product.ptr,
          gstPercent: product.gstPercent,
          schemes: product.schemes.map((scheme) => ({
            minQuantity: scheme.minQuantity,
            discountPercent: scheme.discountPercent,
          })),
        })),
      )

      // FEFO allocation: reserve from the batch that expires soonest and record
      // which batches were used so the delivery can be received with the real
      // batch number and expiry date, and a cancellation can release exactly
      // what was taken. Every line is priced and allocated before any stock is
      // moved, so an unfulfillable line cannot leave a half-applied order.
      const pending = lines.map(({ item, product }) => {
        const { allocations, shortfall } = allocateFefo(product.batches, item.quantity)
        if (shortfall > 0) throw new Error(`Insufficient stock for ${product.name}`)
        return allocations
      })

      const orderItems = []
      for (const [index, { item, product }] of lines.entries()) {
        for (const allocation of pending[index]) {
          await tx.batch.update({ where: { id: allocation.batchId }, data: { quantity: { decrement: allocation.quantity } } })
        }
        orderItems.push({
          productId: product.id,
          quantity: item.quantity,
          price: product.ptr,
          allocations: { create: pending[index] },
        })
      }

      const { subtotal, discount, gst, total } = priced
      const order = await tx.order.create({ data: { buyerId: session.user.organizationId!, sellerId: manufacturerId, status: "PLACED", subtotal, discount, gst, total, notes, poNumber: `PO-${Date.now().toString(36).toUpperCase()}`, items: { create: orderItems }, audits: { create: { status: "PLACED", note: "Purchase order submitted by stockist" } } }, include: { items: true } })
      await notify(tx, { organizationId: manufacturerId, type: "ORDER_PLACED", title: "New purchase order", message: `A new purchase order ${order.poNumber} for ₹${total.toFixed(2)} is waiting for review.`, link: "/manufacturer" })
      return { order, subtotal, discount, gst, total }
    })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to place order"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
