import { NextResponse } from "next/server"
import { z } from "zod"

import { requireRole } from "@/lib/access"
import { notify } from "@/lib/notifications"
import { prisma } from "@/lib/prisma"

const decisionSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["CONFIRMED", "REJECTED"]),
  note: z.string().trim().max(500).optional(),
})

export async function GET() {
  const auth = await requireRole("MANUFACTURER")
  if ("error" in auth) return auth.error
  return NextResponse.json(await prisma.paymentSubmission.findMany({
    where: { manufacturerId: auth.session.user.organizationId! },
    include: {
      stockist: { select: { name: true } },
      order: { select: { poNumber: true, invoiceNumber: true, total: true, paidAmount: true, paymentStatus: true } },
      reviewer: { select: { email: true } },
    },
    orderBy: { submittedAt: "desc" },
  }))
}

export async function PATCH(req: Request) {
  const auth = await requireRole("MANUFACTURER", true)
  if ("error" in auth) return auth.error
  const parsed = decisionSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid payment decision" }, { status: 400 })

  const submission = await prisma.paymentSubmission.findFirst({
    where: { id: parsed.data.id, manufacturerId: auth.session.user.organizationId!, status: "SUBMITTED" },
    include: { order: true },
  })
  if (!submission) return NextResponse.json({ error: "Pending payment submission not found" }, { status: 404 })

  const updated = await prisma.$transaction(async (tx) => {
    const payment = await tx.paymentSubmission.update({
      where: { id: submission.id },
      data: { status: parsed.data.action, reviewedAt: new Date(), reviewerUserId: auth.session.user.id, reviewNote: parsed.data.note },
    })
    if (parsed.data.action === "CONFIRMED") {
      const confirmed = await tx.paymentSubmission.aggregate({ where: { orderId: submission.orderId, status: "CONFIRMED" }, _sum: { amount: true } })
      const paidAmount = Math.min(submission.order.total, Math.round((confirmed._sum.amount ?? 0) * 100) / 100)
      const isPaid = paidAmount >= submission.order.total
      await tx.order.update({
        where: { id: submission.orderId },
        data: { paidAmount, isPaid, paidAt: isPaid ? new Date() : null, paymentStatus: isPaid ? "PAID" : "PARTIALLY_PAID" },
      })
    } else {
      const confirmed = await tx.paymentSubmission.aggregate({ where: { orderId: submission.orderId, status: "CONFIRMED" }, _sum: { amount: true } })
      const paidAmount = Math.round((confirmed._sum.amount ?? 0) * 100) / 100
      await tx.order.update({ where: { id: submission.orderId }, data: { paidAmount, paymentStatus: paidAmount > 0 ? "PARTIALLY_PAID" : "REJECTED" } })
    }
    await tx.orderAudit.create({ data: { orderId: submission.orderId, status: `PAYMENT_${parsed.data.action}`, note: parsed.data.note ?? `Payment ${parsed.data.action.toLowerCase()} by manufacturer` } })
    await notify(tx, { organizationId: submission.stockistId, type: "ORDER_STATUS", title: `Payment ${parsed.data.action.toLowerCase()}`, message: `Reference ${submission.reference} was ${parsed.data.action.toLowerCase()} by the manufacturer.`, link: "/stockist/ledger" })
    return payment
  })
  return NextResponse.json(updated)
}
