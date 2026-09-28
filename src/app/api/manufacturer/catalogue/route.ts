import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "MANUFACTURER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { products } = body

  if (!Array.isArray(products)) {
    return NextResponse.json({ error: "Invalid data format" }, { status: 400 })
  }

  const manufacturerId = session.user.organizationId!

  try {
    // Process products in a transaction
    await prisma.$transaction(
      products.map(p => 
        prisma.product.create({
          data: {
            manufacturerId,
            name: p.name,
            genericName: p.genericName,
            mrp: p.mrp || 0,
            ptr: p.ptr || 0,
            pts: p.pts || 0,
            isActive: true,
          }
        })
      )
    )

    return NextResponse.json({ success: true, count: products.length })
  } catch (error) {
    console.error("Bulk upload error", error)
    return NextResponse.json({ error: "Failed to process catalogue upload" }, { status: 500 })
  }
}
