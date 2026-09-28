import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "STOCKIST" || !session.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const favourites = await prisma.favourite.findMany({ where: { userId: session.user.id }, include: { product: { include: { manufacturer: true, batches: { where: { quantity: { gt: 0 } }, select: { quantity: true } } } } }, orderBy: { createdAt: "desc" } })
  return NextResponse.json(favourites)
}
