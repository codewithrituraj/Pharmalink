import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/access"
import { notify } from "@/lib/notifications"
const requestSchema = z.object({
  orderId: z.string().optional(),
  reason: z.enum(["EXPIRING", "DAMAGED", "WRONG_ITEM"]),
  remark: z.string().trim().max(500).optional(),
  items: z.array(z.object({ inventoryBatchId: z.string().min(1), quantity: z.number().int().positive() })).min(1),
}).superRefine((value, ctx) => {
  const ids = value.items.map((item) => item.inventoryBatchId)
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["items"], message: "Each inventory batch can only appear once" })
  }
})
export async function GET() { const auth = await requireRole("STOCKIST"); if ("error" in auth) return auth.error; return NextResponse.json(await prisma.returnRequest.findMany({ where: { buyerId: auth.session.user.organizationId! }, include: { seller: { select: { name: true } }, items: { include: { product: { select: { name: true } }, inventoryBatch: true } } }, orderBy: { createdAt: "desc" } })) }
export async function POST(req: Request) {
  const auth = await requireRole("STOCKIST", true); if ("error" in auth) return auth.error
  const parsed = requestSchema.safeParse(await req.json()); if (!parsed.success) return NextResponse.json({ error: "Invalid return request", details: parsed.error.flatten() }, { status: 400 })
  const batches = await prisma.inventoryBatch.findMany({ where: { id: { in: parsed.data.items.map((i) => i.inventoryBatchId) }, stockistId: auth.session.user.organizationId! }, include: { product: true } })
  if (batches.length !== parsed.data.items.length) return NextResponse.json({ error: "One or more inventory batches are unavailable" }, { status: 403 })
  const sellerIds = new Set(batches.map((batch) => batch.product.manufacturerId)); if (sellerIds.size !== 1) return NextResponse.json({ error: "A return can include products from one manufacturer only" }, { status: 400 })
  const quantityById = new Map(parsed.data.items.map((item) => [item.inventoryBatchId, item.quantity])); if (batches.some((batch) => (quantityById.get(batch.id) ?? 0) > batch.quantity)) return NextResponse.json({ error: "Return quantity exceeds inventory" }, { status: 400 })
  const sellerId = batches[0]!.product.manufacturerId; const total = batches.reduce((sum, batch) => sum + batch.product.ptr * (quantityById.get(batch.id) ?? 0), 0)
  if (parsed.data.orderId) {
    const order = await prisma.order.findFirst({ where: { id: parsed.data.orderId, buyerId: auth.session.user.organizationId!, sellerId } })
    if (!order) return NextResponse.json({ error: "The selected order does not belong to this return" }, { status: 403 })
  }
  const result = await prisma.$transaction(async (tx) => { const ret = await tx.returnRequest.create({ data: { orderId: parsed.data.orderId, buyerId: auth.session.user.organizationId!, sellerId, reason: parsed.data.reason, remark: parsed.data.remark, total, items: { create: batches.map((batch) => ({ inventoryBatchId: batch.id, productId: batch.productId, quantity: quantityById.get(batch.id)! })) } } }); await notify(tx, { organizationId: sellerId, type: "RETURN_REQUEST", title: "New return request", message: `${batches.length} batch(es) valued at ₹${total.toFixed(2)} await review.`, link: "/manufacturer/returns" }); return ret })
  return NextResponse.json(result, { status: 201 })
}
