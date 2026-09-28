import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notify } from "@/lib/notifications"

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

      let subtotal = 0
      let discount = 0
      let gst = 0
      const orderItems = []
      for (const item of items) {
        const product = products.find((candidate) => candidate.id === item.productId)
        if (!product) throw new Error("Product is unavailable")
        if (item.quantity < product.minOrderQty) throw new Error(`${product.name} requires a minimum order of ${product.minOrderQty}`)
        let remaining = item.quantity
        // FEFO allocation: reserve from the batch that expires soonest and record
        // which batches were used so the delivery can be received with the real
        // batch number and expiry date, and a cancellation can release exactly
        // what was taken.
        const allocations: { batchId: string; quantity: number }[] = []
        for (const batch of product.batches) {
          if (remaining <= 0) break
          const take = Math.min(batch.quantity, remaining)
          await tx.batch.update({ where: { id: batch.id }, data: { quantity: { decrement: take } } })
          allocations.push({ batchId: batch.id, quantity: take })
          remaining -= take
        }
        if (remaining > 0) throw new Error(`Insufficient stock for ${product.name}`)
        const lineTotal = product.ptr * item.quantity
        const scheme = product.schemes.find((candidate) => item.quantity >= candidate.minQuantity)
        const lineDiscount = scheme ? lineTotal * (scheme.discountPercent / 100) : 0
        const taxable = lineTotal - lineDiscount
        subtotal += lineTotal
        discount += lineDiscount
        gst += taxable * (product.gstPercent / 100)
        orderItems.push({
          productId: product.id,
          quantity: item.quantity,
          price: product.ptr,
          allocations: { create: allocations },
        })
      }
      const total = subtotal - discount + gst
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
