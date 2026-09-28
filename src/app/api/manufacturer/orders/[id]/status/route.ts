import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notify } from "@/lib/notifications"

const schema = z.object({ status: z.enum(["APPROVED", "PACKED", "DISPATCHED", "DELIVERED", "REJECTED"]) })
const transitions: Record<string, string[]> = { PLACED: ["APPROVED", "REJECTED"], APPROVED: ["PACKED", "REJECTED"], PACKED: ["DISPATCHED"], DISPATCHED: ["DELIVERED"] }

// These notifications are addressed to the buyer, so every link has to resolve
// for a stockist. Delivered stock lands in inventory; everything else is a view
// of the order itself.
function linkForStockistStatus(status: string, orderId: string) {
  if (status === "DELIVERED") return "/stockist/inventory"
  if (status === "REJECTED") return `/stockist/orders/${orderId}`
  return `/stockist/orders/${orderId}`
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "MANUFACTURER" || !session.user.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  const nextStatus = parsed.data.status
  const { id } = await params
  const order = await prisma.order.findFirst({
    where: { id, sellerId: session.user.organizationId },
    include: {
      items: {
        include: {
          product: { select: { name: true } },
          allocations: { include: { batch: { select: { batchNumber: true, mfgDate: true, expiryDate: true } } } },
        },
      },
    },
  })
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
  if (!transitions[order.status]?.includes(nextStatus)) {
    return NextResponse.json({ error: `Cannot move ${order.status} to ${nextStatus}` }, { status: 409 })
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id },
      data: { status: nextStatus, audits: { create: { status: nextStatus, note: `Manufacturer marked order ${nextStatus.toLowerCase()}` } } },
    })

    const periodStart = new Date()
    periodStart.setDate(1)

    if (nextStatus === "DISPATCHED") {
      await tx.order.update({
        where: { id },
        data: { transporter: "PharmaLink Logistics", trackingNumber: `TRK${order.id.slice(-8).toUpperCase()}` },
      })
    }

    if (nextStatus === "DELIVERED") {
      await tx.order.update({
        where: { id },
        data: { invoiceNumber: `INV-${order.poNumber ?? order.id.slice(-6).toUpperCase()}` },
      })

      for (const item of order.items) {
        // Receive the exact batches that were allocated FEFO at order time, so
        // the stockist's inventory carries the real batch number and expiry.
        const allocations = item.allocations.length
          ? item.allocations
          : order.items
              .filter((candidate) => candidate.productId === item.productId)
              .flatMap((candidate) => candidate.allocations)

        if (allocations.length > 0) {
          await tx.inventoryBatch.createMany({
            data: allocations.map((allocation) => ({
              stockistId: order.buyerId,
              productId: item.productId,
              batchNumber: allocation.batch.batchNumber,
              quantity: allocation.quantity,
              mfgDate: allocation.batch.mfgDate,
              expiryDate: allocation.batch.expiryDate,
              sourceOrderId: order.id,
              receivedAt: new Date(),
            })),
          })
        } else {
          // Orders placed before allocations were tracked still need stock.
          await tx.inventoryBatch.create({
            data: {
              stockistId: order.buyerId,
              productId: item.productId,
              batchNumber: `GEN-${order.id.slice(-6).toUpperCase()}-${item.productId.slice(-4)}`,
              quantity: item.quantity,
              expiryDate: new Date(Date.now() + 365 * 86_400_000),
              sourceOrderId: order.id,
            },
          })
        }

        await tx.demandSample.upsert({
          where: { stockistId_productId_periodStart: { stockistId: order.buyerId, productId: item.productId, periodStart } },
          update: { quantity: { increment: item.quantity } },
          create: { stockistId: order.buyerId, productId: item.productId, periodStart, quantity: item.quantity, source: "DELIVERED_ORDER" },
        })
      }

      const receivedUnits = order.items.reduce((sum, item) => sum + item.quantity, 0)
      await notify(tx, {
        organizationId: order.buyerId,
        type: "ORDER_STATUS",
        severity: "INFO",
        title: `Order ${order.poNumber ?? ""} delivered`.trim(),
        message: `${receivedUnits} units across ${order.items.length} product${order.items.length === 1 ? "" : "s"} are now in your inventory, allocated first-expiry-first-out.`,
        link: linkForStockistStatus(nextStatus, order.id),
      })
    }

    if (nextStatus === "REJECTED") {
      // Release the reserved manufacturer stock back into the earliest batch.
      for (const item of order.items) {
        for (const allocation of item.allocations) {
          await tx.batch.update({ where: { id: allocation.batchId }, data: { quantity: { increment: allocation.quantity } } })
        }
      }
    }

    await notify(tx, {
      organizationId: order.buyerId,
      type: "ORDER_STATUS",
      severity: nextStatus === "REJECTED" ? "WARNING" : "INFO",
      title: `Order ${order.poNumber ?? order.id.slice(-8).toUpperCase()} is now ${nextStatus.toLowerCase()}`,
      message:
        nextStatus === "REJECTED"
          ? "The manufacturer declined this order. Reserved stock has been released — you can reorder from your order page."
          : nextStatus === "DISPATCHED"
            ? "Your order has left the manufacturer and is on its way."
            : `Status updated to ${nextStatus.toLowerCase()}.`,
      link: linkForStockistStatus(nextStatus, order.id),
    })

    return updated
  })

  return NextResponse.json({ success: true, order: result })
}
