import { NextResponse } from "next/server"
import { z } from "zod"

import { requireRole } from "@/lib/access"
import { notify } from "@/lib/notifications"
import { prisma } from "@/lib/prisma"

const paymentSchema = z.object({ paymentRef: z.string().trim().min(1).max(100) })

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("STOCKIST")
  if ("error" in auth) return auth.error

  const body = await req.json().catch(() => null)
  const parsed = paymentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a payment reference to record settlement" }, { status: 400 })
  }

  const { id } = await params
  const order = await prisma.order.findFirst({
    where: {
      id,
      buyerId: auth.session.user.organizationId,
      invoiceNumber: { not: null },
    },
    select: { id: true, sellerId: true, invoiceNumber: true, isPaid: true, total: true, paidAmount: true, paymentStatus: true },
  })
  if (!order) return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  if (order.isPaid) return NextResponse.json({ error: "This invoice is already marked paid" }, { status: 409 })
  if (order.paymentStatus === "SUBMITTED") return NextResponse.json({ error: "A payment is already awaiting manufacturer review" }, { status: 409 })

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({
      where: {
        id: order.id,
        buyerId: auth.session.user.organizationId,
        isPaid: false,
        paymentStatus: { not: "SUBMITTED" },
        invoiceNumber: { not: null },
      },
      data: { paymentStatus: "SUBMITTED", paymentRef: parsed.data.paymentRef },
    })
    if (!updated.count) return false

    const amount = Math.max(0, Math.round((order.total - order.paidAmount) * 100) / 100)
    await tx.paymentSubmission.create({
      data: {
        orderId: order.id,
        stockistId: auth.session.user.organizationId!,
        manufacturerId: order.sellerId,
        amount,
        reference: parsed.data.paymentRef,
      },
    })

    await tx.orderAudit.create({
      data: {
        orderId: order.id,
        status: "PAYMENT_SUBMITTED",
        note: `Payment submitted for manufacturer review. Reference: ${parsed.data.paymentRef}`,
      },
    })
    await notify(tx, {
      organizationId: order.sellerId,
      type: "ORDER_STATUS",
      title: "Payment awaiting review",
      message: `Payment for invoice ${order.invoiceNumber ?? ""} needs confirmation. Reference: ${parsed.data.paymentRef}`,
      link: "/manufacturer/payments",
    })
    return true
  })

  if (!result) return NextResponse.json({ error: "This invoice has already been updated" }, { status: 409 })
  return NextResponse.json({ success: true, invoiceId: order.id, paymentStatus: "SUBMITTED" })
}
