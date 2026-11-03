import { NextResponse } from "next/server"
import { z } from "zod"

import { requireRole } from "@/lib/access"
import { buildPriceComparison } from "@/lib/price-comparison"
import { prisma } from "@/lib/prisma"

const querySchema = z.object({
  genericName: z.string().trim().min(1).max(120),
  strength: z.string().trim().max(80).optional(),
  dosageForm: z.string().trim().max(80).optional(),
  quantity: z.coerce.number().int().min(1).max(100_000).default(1),
})

export async function GET(req: Request) {
  const auth = await requireRole("STOCKIST")
  if ("error" in auth) return auth.error

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid price comparison request" }, { status: 400 })
  }

  const grants = await prisma.accessGrant.findMany({
    where: { stockistId: auth.session.user.organizationId, status: "VERIFIED" },
    select: { manufacturerId: true },
  })
  const manufacturerIds = grants.map((grant) => grant.manufacturerId)
  if (!manufacturerIds.length) return NextResponse.json([])

  const products = await prisma.product.findMany({
    where: {
      manufacturerId: { in: manufacturerIds },
      isActive: true,
      genericName: { contains: parsed.data.genericName },
      ...(parsed.data.strength ? { strength: { contains: parsed.data.strength } } : {}),
      ...(parsed.data.dosageForm ? { dosageForm: parsed.data.dosageForm } : {}),
    },
    include: {
      manufacturer: { select: { name: true } },
      batches: { where: { quantity: { gt: 0 } }, select: { quantity: true } },
      schemes: {
        where: {
          validFrom: { lte: new Date() },
          validUntil: { gte: new Date() },
          OR: [{ stockistId: null }, { stockistId: auth.session.user.organizationId }],
        },
        orderBy: { minQuantity: "desc" },
      },
    },
  })

  const exactMatches = products.filter((product) =>
    product.genericName.trim().toLocaleLowerCase() === parsed.data.genericName.toLocaleLowerCase() &&
    (!parsed.data.strength || product.strength.trim().toLocaleLowerCase() === parsed.data.strength.toLocaleLowerCase()) &&
    (!parsed.data.dosageForm || product.dosageForm === parsed.data.dosageForm),
  )

  return NextResponse.json(buildPriceComparison(exactMatches, parsed.data.quantity))
}