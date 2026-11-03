import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/access"
import { schemeSchema } from "@/lib/validation"
import { notify } from "@/lib/notifications"
export async function GET() { const auth = await requireRole("MANUFACTURER"); if ("error" in auth) return auth.error; return NextResponse.json(await prisma.scheme.findMany({ where: { product: { manufacturerId: auth.session.user.organizationId! } }, include: { product: { select: { name: true } } }, orderBy: { validUntil: "asc" } })) }
export async function POST(req: Request) {
  const auth = await requireRole("MANUFACTURER", true); if ("error" in auth) return auth.error
  const parsed = schemeSchema.safeParse(await req.json()); if (!parsed.success) return NextResponse.json({ error: "Invalid scheme", details: parsed.error.flatten() }, { status: 400 })
  const product = await prisma.product.findFirst({ where: { id: parsed.data.productId, manufacturerId: auth.session.user.organizationId! } }); if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 })
  if (parsed.data.type === "FREE_GOODS" && parsed.data.freeQuantity < 1) return NextResponse.json({ error: "Free goods quantity is required" }, { status: 400 })
  const scheme = await prisma.scheme.create({ data: { ...parsed.data, stockistId: parsed.data.stockistId || null, validFrom: new Date(parsed.data.validFrom), validUntil: new Date(parsed.data.validUntil) } })
  const eligible = parsed.data.stockistId ? [parsed.data.stockistId] : (await prisma.accessGrant.findMany({ where: { manufacturerId: auth.session.user.organizationId!, status: "VERIFIED" }, select: { stockistId: true } })).map((g) => g.stockistId)
  await Promise.all(eligible.map((organizationId) => notify(prisma, { organizationId, type: "SCHEME", title: "New trade scheme", message: `${product.name}: ${scheme.name}`, link: `/stockist/catalogue?manufacturer=${auth.session.user.organizationId}` })))
  return NextResponse.json(scheme, { status: 201 })
}
