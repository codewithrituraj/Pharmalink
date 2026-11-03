import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notify } from "@/lib/notifications"

const createSchema = z.object({
  productId: z.string().min(1),
  batchNumber: z.string().trim().min(1).max(80),
  quantity: z.coerce.number().int().min(1).max(1_000_000),
  expiryDate: z.coerce.date(),
  mfgDate: z.coerce.date().optional(),
})

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "STOCKIST" || !session.user.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const stockistId = session.user.organizationId
  const { searchParams } = new URL(req.url)
  const query = searchParams.get("q")?.trim() ?? ""

  const batches = await prisma.inventoryBatch.findMany({
    where: {
      stockistId,
      ...(query
        ? {
            OR: [
              { batchNumber: { contains: query } },
              { product: { name: { contains: query } } },
              { product: { genericName: { contains: query } } },
            ],
          }
        : {}),
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          genericName: true,
          category: true,
          strength: true,
          packSize: true,
          ptr: true,
          minOrderQty: true,
          leadTimeDays: true,
          manufacturer: { select: { name: true } },
        },
      },
      sourceOrder: { select: { id: true, poNumber: true, status: true } },
    },
    orderBy: [{ expiryDate: "asc" }, { receivedAt: "desc" }],
  })

  const now = new Date()
  const serialized = batches.map((batch) => {
    const daysRemaining = Math.ceil(
      (batch.expiryDate.getTime() - now.getTime()) / 86_400_000,
    )
    return {
      id: batch.id,
      productId: batch.productId,
      productName: batch.product.name,
      brand: batch.product.manufacturer.name,
      strength: batch.product.strength,
      packSize: batch.product.packSize,
      genericName: batch.product.genericName,
      category: batch.product.category,
      manufacturerName: batch.product.manufacturer.name,
      batchNumber: batch.batchNumber,
      quantity: batch.quantity,
      unitPrice: batch.product.ptr,
      value: Math.round(batch.quantity * batch.product.ptr * 100) / 100,
      expiryDate: batch.expiryDate.toISOString(),
      mfgDate: batch.mfgDate ? batch.mfgDate.toISOString() : null,
      receivedAt: batch.receivedAt.toISOString(),
      daysRemaining,
      status:
        daysRemaining <= 0
          ? "EXPIRED"
          : daysRemaining <= 30
            ? "EXPIRING"
            : daysRemaining <= 90
              ? "WATCH"
              : "OK",
      source: batch.sourceOrderId ? "DELIVERY" : "MANUAL",
      sourceOrderId: batch.sourceOrderId,
      sourceOrder: batch.sourceOrder
        ? {
            id: batch.sourceOrder.id,
            poNumber: batch.sourceOrder.poNumber,
            status: batch.sourceOrder.status,
          }
        : null,
    }
  })

  const productIds = [...new Set(batches.map((batch) => batch.productId))]
  const openOrderItems = await prisma.orderItem.findMany({
    where: {
      productId: { in: productIds },
      order: {
        buyerId: stockistId,
        status: { in: ["PLACED", "APPROVED", "PACKED", "DISPATCHED"] },
      },
    },
    select: { productId: true, quantity: true },
  })
  const openByProduct = new Map<string, number>()
  for (const item of openOrderItems) {
    openByProduct.set(item.productId, (openByProduct.get(item.productId) ?? 0) + item.quantity)
  }

  const stockByProduct = new Map<string, number>()
  for (const batch of serialized) {
    stockByProduct.set(
      batch.productId,
      (stockByProduct.get(batch.productId) ?? 0) + batch.quantity,
    )
  }

  const expiringSoon = serialized.filter(
    (batch) => batch.daysRemaining > 0 && batch.daysRemaining <= 90,
  ).length
  const daysCover = [
    { bucket: "≤30d", units: serialized.filter((batch) => batch.daysRemaining > 0 && batch.daysRemaining <= 30).reduce((sum, batch) => sum + batch.quantity, 0) },
    { bucket: "31–60d", units: serialized.filter((batch) => batch.daysRemaining > 30 && batch.daysRemaining <= 60).reduce((sum, batch) => sum + batch.quantity, 0) },
    { bucket: "61–90d", units: serialized.filter((batch) => batch.daysRemaining > 60 && batch.daysRemaining <= 90).reduce((sum, batch) => sum + batch.quantity, 0) },
  ].filter((bucket) => bucket.units > 0)
  const productDetails = new Map(
    batches.map((batch) => [batch.productId, batch.product]),
  )
  const products = [...stockByProduct.entries()]
    .map(([productId, onHand]) => {
      const product = productDetails.get(productId)!
      return {
        id: productId,
        productId,
        name: product.name,
        brand: product.manufacturer.name,
        strength: product.strength,
        packSize: product.packSize,
        minOrderQty: product.minOrderQty,
        onHand,
        onOrder: openByProduct.get(productId) ?? 0,
      }
    })
    .sort((a, b) => b.onHand - a.onHand)

  return NextResponse.json({
    serverTime: new Date().toISOString(),
    summary: {
      totalBatches: serialized.length,
      totalUnits: serialized.reduce((sum, batch) => sum + batch.quantity, 0),
      totalValue:
        Math.round(serialized.reduce((sum, batch) => sum + batch.value, 0) * 100) / 100,
      productCount: stockByProduct.size,
      expiring30: serialized.filter(
        (batch) => batch.daysRemaining > 0 && batch.daysRemaining <= 30,
      ).length,
      expiring60: serialized.filter(
        (batch) => batch.daysRemaining > 0 && batch.daysRemaining <= 60,
      ).length,
      expiring90: serialized.filter(
        (batch) => batch.daysRemaining > 0 && batch.daysRemaining <= 90,
      ).length,
      expiringSoon,
      expired: serialized.filter((batch) => batch.daysRemaining <= 0).length,
      openOrderUnits: openOrderItems.reduce((sum, item) => sum + item.quantity, 0),
    },
    products,
    daysCover,
    topProducts: products.slice(0, 8).map((product) => ({
      key: product.productId,
      label: product.name,
      value: product.onHand,
      detail: `${product.brand} · ${product.onOrder.toLocaleString("en-IN")} on order`,
    })),
    batches: serialized,
  })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "STOCKIST" || !session.user.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const stockistId = session.user.organizationId
  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the batch details and try again", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  // Ownership: the product must belong to a manufacturer this stockist is
  // verified to buy from.
  const product = await prisma.product.findFirst({
    where: {
      id: parsed.data.productId,
      isActive: true,
      manufacturer: {
        grantedAccess: { some: { stockistId, status: "VERIFIED" } },
      },
    },
    select: { id: true, name: true, manufacturer: { select: { name: true } } },
  })
  if (!product) {
    return NextResponse.json(
      { error: "That product is not in your authorized catalogue" },
      { status: 403 },
    )
  }

  const batch = await prisma.$transaction(async (tx) => {
    const created = await tx.inventoryBatch.create({
      data: {
        stockistId,
        productId: parsed.data.productId,
        batchNumber: parsed.data.batchNumber,
        quantity: parsed.data.quantity,
        expiryDate: parsed.data.expiryDate,
        ...(parsed.data.mfgDate ? { mfgDate: parsed.data.mfgDate } : {}),
      },
      include: {
        product: {
          select: {
            name: true,
            genericName: true,
            ptr: true,
            manufacturer: { select: { name: true } },
          },
        },
      },
    })

    await notify(tx, {
      organizationId: stockistId,
      type: "EXPIRY",
      severity:
        parsed.data.expiryDate.getTime() - Date.now() <= 30 * 86_400_000
          ? "WARNING"
          : "INFO",
      title: `${product.name} batch ${parsed.data.batchNumber} recorded`,
      message: `${parsed.data.quantity} units from ${product.manufacturer.name} added to your inventory. The batch expires on ${parsed.data.expiryDate.toLocaleDateString("en-IN")}.`,
      link: "/stockist/inventory",
    })

    return created
  })

  return NextResponse.json(
    {
      success: true,
      batch: {
        ...batch,
        expiryDate: batch.expiryDate.toISOString(),
        mfgDate: batch.mfgDate ? batch.mfgDate.toISOString() : null,
        receivedAt: batch.receivedAt.toISOString(),
      },
    },
    { status: 201 },
  )
}
