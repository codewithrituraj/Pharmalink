import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/access"
import { productSchema } from "@/lib/validation"
import { persistNppaCompliance } from "@/lib/nppa-compliance"

export async function GET() {
  const auth = await requireRole("MANUFACTURER")
  if ("error" in auth) return auth.error
  const products = await prisma.product.findMany({
    where: { manufacturerId: auth.session.user.organizationId! },
    include: { batches: true, schemes: true, complianceViolations: { where: { active: true }, include: { reference: true } } },
    orderBy: { name: "asc" },
  })
  return NextResponse.json(products)
}

export async function POST(req: Request) {
  const auth = await requireRole("MANUFACTURER", true)
  if ("error" in auth) return auth.error
  const parsed = productSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: "Invalid product", details: parsed.error.flatten() }, { status: 400 })
  const manufacturerId = auth.session.user.organizationId!
  const result = await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        ...parsed.data,
        composition: parsed.data.composition || parsed.data.genericName,
        imageUrl: parsed.data.imageUrl || null,
        manufacturerId,
      },
    })
    const compliance = await persistNppaCompliance(tx, product)
    return { product, compliance }
  })
  return NextResponse.json(result, { status: 201 })
}
