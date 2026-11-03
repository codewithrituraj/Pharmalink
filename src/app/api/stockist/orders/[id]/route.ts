import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canCancel } from "@/lib/orders"
import { loadOrderForBuyer } from "@/lib/order-detail"
import { recordOrderDelivery } from "@/lib/delivery"

const actionSchema = z.object({
  action: z.enum(["CANCEL", "REORDER", "SIMULATE_NEXT"]),
})

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "STOCKIST" || !session.user.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { id } = await params
  const order = await loadOrderForBuyer(session.user.organizationId, id)
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
  return NextResponse.json(order)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "STOCKIST" || !session.user.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = actionSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: "Invalid order action" }, { status: 400 })

  const { id } = await params
  const order = await prisma.order.findFirst({
    where: { id, buyerId: session.user.organizationId },
    include: {
      seller: true,
      items: {
        include: {
          allocations: {
            include: {
              batch: true,
            },
          },
        },
      },
    },
  })
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

  if (parsed.data.action === "REORDER") {
    return NextResponse.json({
      manufacturerId: order.sellerId,
      items: order.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
    })
  }

  if (parsed.data.action === "SIMULATE_NEXT") {
    const nextMap: Record<string, string> = {
      PLACED: "APPROVED",
      APPROVED: "PACKED",
      PACKED: "DISPATCHED",
      DISPATCHED: "DELIVERED",
    }
    const nextStatus = nextMap[order.status]
    if (!nextStatus) {
      return NextResponse.json({ error: `Cannot advance beyond ${order.status}` }, { status: 400 })
    }

    const updated = await prisma.$transaction(async (tx) => {
      const isApproved = nextStatus === "APPROVED"
      const isDispatched = nextStatus === "DISPATCHED"
      const isDelivered = nextStatus === "DELIVERED"

      const invNum =
        order.invoiceNumber || `INV-${new Date().getFullYear()}-${order.id.slice(-7).toUpperCase()}`

      const saved = await tx.order.update({
        where: { id: order.id },
        data: {
          status: nextStatus,
          ...(isApproved || (isDelivered && !order.invoiceNumber)
            ? {
                invoiceNumber: invNum,
                invoiceCreatedAt: order.invoiceCreatedAt || new Date(),
              }
            : {}),
          ...(isDispatched
            ? {
                transporter: order.transporter || "BlueDart Express",
                trackingNumber: order.trackingNumber || `BD${Date.now().toString().slice(-8)}IN`,
                expectedDelivery: new Date(Date.now() + 3 * 86_400_000),
              }
            : {}),
          audits: {
            create: {
              status: nextStatus,
              note: `Status advanced to ${nextStatus.toLowerCase()} via fulfilment simulation`,
            },
          },
        },
      })

      if (isDelivered) {
        await recordOrderDelivery(tx, order)
      }

      return saved
    })

    return NextResponse.json({ success: true, order: updated })
  }

  // Action is CANCEL
  if (!canCancel(order.status)) {
    return NextResponse.json({ error: "This order can no longer be cancelled" }, { status: 409 })
  }

  const updated = await prisma.$transaction(async (tx) => {
    // Release exactly the batches this order reserved.
    for (const item of order.items) {
      for (const allocation of item.allocations) {
        await tx.batch.update({
          where: { id: allocation.batchId },
          data: { quantity: { increment: allocation.quantity } },
        })
      }
    }
    return tx.order.update({
      where: { id: order.id },
      data: {
        status: "CANCELLED",
        audits: { create: { status: "CANCELLED", note: "Cancelled by stockist" } },
      },
    })
  })

  return NextResponse.json({ success: true, order: updated })
}
