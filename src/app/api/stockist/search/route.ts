import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const querySchema = z.object({
  q: z.string().trim().default(""),
  manufacturerId: z.string().optional(),
  dosageForm: z.string().optional(),
  strength: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  availability: z.enum(["in-stock", "low", "out"]).optional(),
  prescription: z.enum(["yes", "no"]).optional(),
  sort: z.enum(["relevance", "price-asc", "price-desc", "name"]).default("relevance"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
})

function scoreProduct(query: string, product: { name: string; genericName: string; manufacturer: { name: string } }) {
  if (!query) return 0
  const normalized = query.toLowerCase()
  const fields = [product.name, product.genericName, product.manufacturer.name].map((field) => field.toLowerCase())
  return fields.reduce((score, field, index) => score + (field.includes(normalized) ? 100 - index * 10 : normalized.split(" ").filter((token) => field.includes(token)).length * 10), 0)
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "STOCKIST" || !session.user.organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams))
  if (!parsed.success) return NextResponse.json({ error: "Invalid catalogue filters" }, { status: 400 })
  const filters = parsed.data
  const now = new Date()
  const grants = await prisma.accessGrant.findMany({ where: { stockistId: session.user.organizationId, status: "VERIFIED" }, select: { manufacturerId: true } })
  const manufacturerIds = filters.manufacturerId ? grants.map((grant) => grant.manufacturerId).filter((id) => id === filters.manufacturerId) : grants.map((grant) => grant.manufacturerId)
  if (manufacturerIds.length === 0) return NextResponse.json({ products: [], total: 0, page: filters.page, pageSize: filters.pageSize, pages: 0 })

  const products = await prisma.product.findMany({
    where: {
      manufacturerId: { in: manufacturerIds }, isActive: true,
      ...(filters.dosageForm ? { dosageForm: filters.dosageForm } : {}),
      ...(filters.strength ? { strength: { contains: filters.strength } } : {}),
      ...(filters.minPrice !== undefined || filters.maxPrice !== undefined ? { ptr: { ...(filters.minPrice !== undefined ? { gte: filters.minPrice } : {}), ...(filters.maxPrice !== undefined ? { lte: filters.maxPrice } : {}) } } : {}),
      ...(filters.prescription ? { isPrescription: filters.prescription === "yes" } : {}),
      ...(filters.availability === "out" ? { batches: { none: { quantity: { gt: 0 } } } } : filters.availability ? { batches: { some: { quantity: { gt: 0 } } } } : {}),
      ...(filters.q ? { OR: [{ name: { contains: filters.q } }, { genericName: { contains: filters.q } }, { manufacturer: { name: { contains: filters.q } } }] } : {}),
    },
    include: {
      manufacturer: { select: { id: true, name: true, region: true } },
      batches: { where: { quantity: { gt: 0 } }, select: { quantity: true, expiryDate: true } },
      schemes: { where: { validFrom: { lte: now }, validUntil: { gte: now } }, orderBy: { minQuantity: "desc" } },
      favourites: { where: { userId: session.user.id }, select: { id: true } },
    },
  })

  const formatted = products.map((product) => {
    const totalStock = product.batches.reduce((sum, batch) => sum + batch.quantity, 0)
    const availability = totalStock === 0 ? "Out" : totalStock < product.minOrderQty * 10 ? "Low" : "In stock"
    return { ...product, totalStock, availability, isFavourite: product.favourites.length > 0, relevance: scoreProduct(filters.q, product) }
  }).filter((product) => filters.availability !== "low" || product.availability === "Low")

  formatted.sort((a, b) => filters.sort === "price-asc" ? a.ptr - b.ptr : filters.sort === "price-desc" ? b.ptr - a.ptr : filters.sort === "name" ? a.name.localeCompare(b.name) : b.relevance - a.relevance)
  const total = formatted.length
  const start = (filters.page - 1) * filters.pageSize
  return NextResponse.json({ products: formatted.slice(start, start + filters.pageSize), total, page: filters.page, pageSize: filters.pageSize, pages: Math.ceil(total / filters.pageSize) })
}
