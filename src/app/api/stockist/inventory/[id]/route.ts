import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const updateSchema = z
  .object({
    quantity: z.coerce.number().int().min(0).max(1_000_000).optional(),
    batchNumber: z.string().trim().min(1).max(80).optional(),
    expiryDate: z.coerce.date().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Nothing to update",
  })

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "STOCKIST" || !session.user.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const parsed = updateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
  }

  // Ownership: the batch must belong to the signed-in stockist.
  const batch = await prisma.inventoryBatch.findFirst({
    where: { id, stockistId: session.user.organizationId },
    select: { id: true },
  })
  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 })
  }

  const updated = await prisma.inventoryBatch.update({
    where: { id },
    data: {
      ...(parsed.data.quantity !== undefined ? { quantity: parsed.data.quantity } : {}),
      ...(parsed.data.batchNumber !== undefined ? { batchNumber: parsed.data.batchNumber } : {}),
      ...(parsed.data.expiryDate !== undefined ? { expiryDate: parsed.data.expiryDate } : {}),
    },
  })

  return NextResponse.json({
    success: true,
    batch: {
      ...updated,
      expiryDate: updated.expiryDate.toISOString(),
      receivedAt: updated.receivedAt.toISOString(),
    },
  })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "STOCKIST" || !session.user.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const batch = await prisma.inventoryBatch.findFirst({
    where: { id, stockistId: session.user.organizationId },
    select: { id: true },
  })
  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 })
  }

  await prisma.inventoryBatch.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
