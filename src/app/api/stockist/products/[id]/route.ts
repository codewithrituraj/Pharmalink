import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "STOCKIST" || !session.user.organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const now = new Date()
  const product = await prisma.product.findFirst({ where: { id, manufacturer: { grantedAccess: { some: { stockistId: session.user.organizationId, status: "VERIFIED" } } } }, include: { manufacturer: true, batches: { orderBy: { expiryDate: "asc" } }, schemes: { where: { validFrom: { lte: now }, validUntil: { gte: now } }, orderBy: { minQuantity: "desc" } }, favourites: { where: { userId: session.user.id } } } })
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 })
  const totalStock = product.batches.reduce((sum, batch) => sum + batch.quantity, 0)
  return NextResponse.json({ ...product, totalStock, availability: totalStock === 0 ? "Out" : totalStock < product.minOrderQty * 10 ? "Low" : "In stock", isFavourite: product.favourites.length > 0 })
}
