import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { notify } from "@/lib/notifications"
import { allocateFefo, priceLines } from "@/lib/orders"
import { requireRole } from "@/lib/access"

const orderSchema = z.object({
  manufacturerId: z.string().min(1).optional(),
  notes: z.union([z.string().trim().max(1000), z.record(z.string())]).optional(),
  draftIds: z.array(z.string().min(1)).max(100).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive(),
        h1Register: z.object({
          patientName: z.string().trim().min(2).max(160),
          prescriberName: z.string().trim().min(2).max(160),
          prescriberRegistrationNumber: z.string().trim().min(2).max(100),
          quantity: z.number().int().positive(),
        }).optional(),
      }),
    )
    .min(1),
})

export async function GET() {
  const auth = await requireRole("STOCKIST")
  if ("error" in auth) return auth.error
  const orders = await prisma.order.findMany({
    where: { buyerId: auth.session.user.organizationId },
    include: {
      seller: { select: { name: true } },
      items: {
        include: {
          product: { select: { name: true, genericName: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(orders)
}

export async function POST(req: Request) {
  const auth = await requireRole("STOCKIST", true)
  if ("error" in auth) return auth.error

  const body = await req.json().catch(() => null)
  const parsed = orderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid order data", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { items, notes } = parsed.data
  const buyerId = auth.session.user.organizationId!

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch all products requested
      const productIds = items.map((i) => i.productId)
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, isActive: true },
        include: {
          manufacturer: { select: { id: true, name: true } },
          schemes: {
            where: { validFrom: { lte: new Date() }, validUntil: { gte: new Date() } },
            orderBy: { minQuantity: "desc" },
          },
          batches: {
            where: { quantity: { gt: 0 } },
            orderBy: { expiryDate: "asc" },
          },
        },
      })

      if (products.length !== productIds.length) {
        throw new Error("One or more requested medicines are no longer available in the catalogue.")
      }

      const productsById = new Map(products.map((product) => [product.id, product]))
      for (const item of items) {
        const product = productsById.get(item.productId)!
        if (product.isScheduleH1 && (!item.h1Register || item.h1Register.quantity !== item.quantity)) {
          throw new Error(`Schedule H1 register details are required for ${product.name}, with quantity matching the order line.`)
        }
      }

      // Group products & items by manufacturer
      const itemsByManufacturer = new Map<string, typeof items>()
      for (const item of items) {
        const prod = products.find((p) => p.id === item.productId)!
        const list = itemsByManufacturer.get(prod.manufacturerId) ?? []
        list.push(item)
        itemsByManufacturer.set(prod.manufacturerId, list)
      }

      const createdOrders = []
      let totalSubtotal = 0
      let totalDiscount = 0
      let totalGst = 0
      let grandTotal = 0

      let mfrOrderSeq = 0
      for (const [mfrId, mfrItems] of itemsByManufacturer.entries()) {
        mfrOrderSeq += 1
        // Verify access grant
        const grant = await tx.accessGrant.findFirst({
          where: { manufacturerId: mfrId, stockistId: buyerId, status: "VERIFIED" },
        })
        const mfrName = products.find((p) => p.manufacturerId === mfrId)?.manufacturer.name || "Manufacturer"
        if (!grant) {
          throw new Error(`You do not have verified purchasing access for ${mfrName}.`)
        }

        // Pair lines with products
        const lines = mfrItems.map((item) => {
          const product = products.find((p) => p.id === item.productId)!
          if (item.quantity < product.minOrderQty) {
            throw new Error(`${product.name} requires a minimum order quantity (MOQ) of ${product.minOrderQty}.`)
          }
          return { item, product }
        })

        // Price order lines
        const priced = priceLines(
          lines.map(({ item, product }) => ({
            quantity: item.quantity,
            unitPrice: product.ptr,
            gstPercent: product.gstPercent,
            schemes: product.schemes
              .filter((scheme) => !scheme.stockistId || scheme.stockistId === buyerId)
              .map((scheme) => ({
                name: scheme.name,
                type: scheme.type,
                minQuantity: scheme.minQuantity,
                discountPercent: Math.max(scheme.discountPercent, grant.customDiscount ?? 0),
                freeQuantity: scheme.freeQuantity,
              })),
          })),
        )

        // Allocate FEFO
        const pendingAllocations = lines.map(({ item, product }) => {
          const { allocations, shortfall } = allocateFefo(product.batches, item.quantity)
          if (shortfall > 0) {
            throw new Error(`Insufficient batch stock for ${product.name} (shortfall of ${shortfall} units).`)
          }
          return allocations
        })

        // Decrement batches and build order items
        const orderItemsData = []
        for (const [idx, { item, product }] of lines.entries()) {
          for (const allocation of pendingAllocations[idx]) {
            await tx.batch.update({
              where: { id: allocation.batchId },
              data: { quantity: { decrement: allocation.quantity } },
            })
          }
          orderItemsData.push({
            productId: product.id,
            quantity: item.quantity,
            freeQuantity: priced.lines[idx].freeQuantity,
            price: product.ptr,
            allocations: { create: pendingAllocations[idx] },
          })
        }

        // Get notes for this manufacturer
        let mfrNote = ""
        if (typeof notes === "string") {
          mfrNote = notes
        } else if (notes && typeof notes === "object") {
          mfrNote = notes[mfrId] || ""
        }

        const poNumber = `PO-${Date.now().toString(36).toUpperCase()}-${mfrOrderSeq}`
        const { subtotal, discount, gst, total } = priced
        totalSubtotal += subtotal
        totalDiscount += discount
        totalGst += gst
        grandTotal += total

        const order = await tx.order.create({
          data: {
            buyerId,
            sellerId: mfrId,
            status: "PLACED",
            subtotal,
            discount,
            gst,
            total,
            notes: mfrNote || null,
            poNumber,
            items: { create: orderItemsData },
            audits: {
              create: {
                status: "PLACED",
                note: `Purchase order submitted by stockist (${mfrItems.length} lines)`,
              },
            },
          },
          include: {
            items: true,
            seller: { select: { name: true } },
          },
        })

        for (const { item, product } of lines) {
          if (!product.isScheduleH1) continue
          const register = item.h1Register!
          const createdItem = order.items.find((orderItem) => orderItem.productId === product.id)
          if (!createdItem) throw new Error(`Could not link the H1 register entry for ${product.name}.`)
          await tx.h1RegisterEntry.create({
            data: {
              orderId: order.id,
              orderItemId: createdItem.id,
              productId: product.id,
              buyerId,
              buyerName: auth.user.organization?.name ?? auth.session.user.email ?? "Stockist",
              patientName: register.patientName,
              prescriberName: register.prescriberName,
              prescriberRegistrationNumber: register.prescriberRegistrationNumber,
              quantity: item.quantity,
            },
          })
        }

        await notify(tx, {
          organizationId: mfrId,
          type: "ORDER_PLACED",
          title: "New purchase order",
          message: `PO ${order.poNumber} from ${auth.session.user.email} for ₹${total.toFixed(2)} is awaiting review.`,
          link: "/manufacturer/orders",
        })

        createdOrders.push(order)
      }

      const draftIds = parsed.data.draftIds ?? []
      if (draftIds.length) {
        const drafts = await tx.cartDraft.findMany({
          where: {
            id: { in: draftIds },
            stockistId: buyerId,
            manufacturerId: { in: [...itemsByManufacturer.keys()] },
          },
          select: { id: true },
        })
        const consumedDraftIds = drafts.map((draft) => draft.id)
        if (consumedDraftIds.length) {
          await tx.cartDraftItem.deleteMany({ where: { draftId: { in: consumedDraftIds } } })
          await tx.cartDraft.deleteMany({ where: { id: { in: consumedDraftIds }, stockistId: buyerId } })
        }
      }

      return {
        orders: createdOrders,
        order: createdOrders[0],
        subtotal: totalSubtotal,
        discount: totalDiscount,
        gst: totalGst,
        total: grandTotal,
      }
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to place order"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
