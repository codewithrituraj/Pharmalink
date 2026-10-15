import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/access"
import { productSchema } from "@/lib/validation"
import { persistNppaCompliance } from "@/lib/nppa-compliance"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("MANUFACTURER", true)
  if ("error" in auth) return auth.error
  const parsed = productSchema.partial().safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: "Invalid product", details: parsed.error.flatten() }, { status: 400 })
  const { id } = await params
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.product.findFirst({ where: { id, manufacturerId: auth.session.user.organizationId! } })
    if (!current) return null
    const product = await tx.product.update({
      where: { id },
      data: {
        ...parsed.data,
        composition: parsed.data.composition || undefined,
        imageUrl: parsed.data.imageUrl || undefined,
      },
    })
    const compliance = await persistNppaCompliance(tx, product)
    return { product, compliance }
  })
  if (!result) return NextResponse.json({ error: "Product not found" }, { status: 404 })
  return NextResponse.json(result)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("MANUFACTURER", true)
  if ("error" in auth) return auth.error
  const { id } = await params
  const product = await prisma.product.findFirst({ where: { id, manufacturerId: auth.session.user.organizationId! } })
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 })
  await prisma.product.update({ where: { id }, data: { isActive: false } })
  return new NextResponse(null, { status: 204 })
}
