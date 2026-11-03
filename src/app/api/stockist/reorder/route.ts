import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const reorderSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().positive().max(1_000_000),
  notes: z.string().trim().max(1000).optional().default(""),
})

/**
 * Turns a reorder recommendation into a real purchase-order draft so the
 * "Add to cart" action persists server side and can be reviewed on the
 * catalogue page. Products from another manufacturer cannot share a draft,
 * which is why the payload only ever carries one product.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "STOCKIST" || !session.user.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const stockistId = session.user.organizationId
  const parsed = reorderSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid reorder request", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const product = await prisma.product.findFirst({
    where: {
      id: parsed.data.productId,
      isActive: true,
      manufacturer: {
        grantedAccess: { some: { stockistId, status: "VERIFIED" } },
      },
    },
    select: {
      id: true,
      name: true,
      ptr: true,
      minOrderQty: true,
      manufacturerId: true,
      manufacturer: { select: { name: true } },
      batches: { where: { quantity: { gt: 0 } }, select: { quantity: true } },
    },
  })
  if (!product) {
    return NextResponse.json(
      { error: "That product is not in your authorized catalogue" },
      { status: 403 },
    )
  }

  const quantity = Math.max(parsed.data.quantity, product.minOrderQty)
  const availableStock = product.batches.reduce((sum, batch) => sum + batch.quantity, 0)
  if (availableStock <= 0) {
    return NextResponse.json(
      { error: `${product.name} is currently out of stock at ${product.manufacturer.name}` },
      { status: 409 },
    )
  }

  const draft = await prisma.$transaction(async (tx) => {
    // Reuse the stockist's open draft for this manufacturer when possible.
    const existing = await tx.cartDraft.findFirst({
      where: { stockistId, manufacturerId: product.manufacturerId },
      include: { items: true },
      orderBy: { updatedAt: "desc" },
    })

    const draftInclude = {
      items: { include: { product: { select: { name: true, ptr: true } } } },
    } as const

    if (existing) {
      const line = existing.items.find((item) => item.productId === product.id)
      if (line) {
        await tx.cartDraftItem.update({
          where: { id: line.id },
          data: { quantity: line.quantity + quantity },
        })
      } else {
        // The draft is for this manufacturer but a different product, so append
        // a new line rather than assuming the product is already there.
        await tx.cartDraftItem.create({
          data: { draftId: existing.id, productId: product.id, quantity },
        })
      }
      return tx.cartDraft.update({
        where: { id: existing.id },
        data: { updatedAt: new Date() },
        include: draftInclude,
      })
    }

    return tx.cartDraft.create({
      data: {
        stockistId,
        manufacturerId: product.manufacturerId,
        notes: parsed.data.notes,
        items: {
          create: [{ productId: product.id, quantity }],
        },
      },
      include: draftInclude,
    })
  })

  return NextResponse.json(
    {
      success: true,
      draftId: draft.id,
      manufacturerId: draft.manufacturerId,
      productName: product.name,
      quantity,
      estimatedCost: Math.round(quantity * product.ptr * 100) / 100,
      itemCount: draft.items.length,
    },
    { status: 201 },
  )
}

/**
 * Returns the stockist's open purchase-order drafts. The catalogue uses this to
 * show a reorder that was saved from the insights or dashboard page.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "STOCKIST" || !session.user.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const drafts = await prisma.cartDraft.findMany({
    where: { stockistId: session.user.organizationId },
    include: {
      manufacturer: { select: { name: true } },
      items: { select: { productId: true, quantity: true } },
    },
    orderBy: { updatedAt: "desc" },
  })

  const requested = new URL(req.url).searchParams.get("manufacturerId")

  return NextResponse.json({
    drafts: drafts
      .filter((draft) => draft.items.length > 0)
      .filter((draft) => !requested || draft.manufacturerId === requested)
      .map((draft) => ({
        id: draft.id,
        manufacturerId: draft.manufacturerId,
        manufacturerName: draft.manufacturer.name,
        notes: draft.notes ?? "",
        items: draft.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      })),
  })
}
