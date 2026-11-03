import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const querySchema = z.object({
  q: z.string().trim().default(""),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

/** Lightweight picker source for "record a received batch" — authorized products only. */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "STOCKIST" || !session.user.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  )
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid search" }, { status: 400 })
  }
  const { q, limit } = parsed.data

  const grants = await prisma.accessGrant.findMany({
    where: { stockistId: session.user.organizationId, status: "VERIFIED" },
    select: { manufacturerId: true },
  })
  const manufacturerIds = grants.map((grant) => grant.manufacturerId)
  if (manufacturerIds.length === 0) return NextResponse.json({ products: [] })

  const products = await prisma.product.findMany({
    where: {
      manufacturerId: { in: manufacturerIds },
      isActive: true,
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { genericName: { contains: q } },
              { manufacturer: { name: { contains: q } } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      genericName: true,
      strength: true,
      packSize: true,
      ptr: true,
      minOrderQty: true,
      manufacturer: { select: { name: true } },
    },
    orderBy: { name: "asc" },
    take: limit,
  })

  return NextResponse.json({ products })
}
