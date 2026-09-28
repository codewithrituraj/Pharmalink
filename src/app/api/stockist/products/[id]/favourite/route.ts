import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const schema = z.object({ productId: z.string().min(1) })

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "STOCKIST" || !session.user.id || !session.user.organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: "Invalid product" }, { status: 400 })
  const product = await prisma.product.findFirst({ where: { id: parsed.data.productId, manufacturer: { grantedAccess: { some: { stockistId: session.user.organizationId, status: "VERIFIED" } } } } })
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 })
  const existing = await prisma.favourite.findUnique({ where: { userId_productId: { userId: session.user.id, productId: product.id } } })
  if (existing) {
    await prisma.favourite.delete({ where: { id: existing.id } })
    return NextResponse.json({ isFavourite: false })
  }
  await prisma.favourite.create({ data: { userId: session.user.id, productId: product.id } })
  return NextResponse.json({ isFavourite: true })
}
