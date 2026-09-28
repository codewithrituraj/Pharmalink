import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const actionSchema = z.object({ action: z.enum(["CANCEL", "REORDER"]) })

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "STOCKIST" || !session.user.organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const order = await prisma.order.findFirst({ where: { id, buyerId: session.user.organizationId }, include: { seller: true, items: { include: { product: true } }, audits: { orderBy: { createdAt: "asc" } } } })
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
  return NextResponse.json(order)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "STOCKIST" || !session.user.organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const parsed = actionSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: "Invalid order action" }, { status: 400 })
  const { id } = await params
  const order = await prisma.order.findFirst({ where: { id, buyerId: session.user.organizationId }, include: { items: { include: { allocations: true } } } })
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
  if (parsed.data.action === "REORDER") return NextResponse.json({ manufacturerId: order.sellerId, items: order.items.map((item) => ({ productId: item.productId, quantity: item.quantity })) })
  if (!["PLACED", "APPROVED"].includes(order.status)) return NextResponse.json({ error: "This order can no longer be cancelled" }, { status: 409 })
  const updated = await prisma.$transaction(async (tx) => {
    // Release exactly the batches this order reserved.
    for (const item of order.items) {
      for (const allocation of item.allocations) {
        await tx.batch.update({ where: { id: allocation.batchId }, data: { quantity: { increment: allocation.quantity } } })
      }
    }
    return tx.order.update({ where: { id: order.id }, data: { status: "CANCELLED", audits: { create: { status: "CANCELLED", note: "Cancelled by stockist" } } } })
  })
  return NextResponse.json({ success: true, order: updated })
}
