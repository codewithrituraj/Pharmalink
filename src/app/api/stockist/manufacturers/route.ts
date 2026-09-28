import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notify } from "@/lib/notifications"

const requestSchema = z.object({
  manufacturerId: z.string().min(1),
  message: z.string().trim().max(500).optional().default(""),
})

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "STOCKIST" || !session.user.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const query = searchParams.get("q")?.trim() ?? ""
  const region = searchParams.get("region")?.trim() ?? ""
  const category = searchParams.get("category")?.trim() ?? ""

  const manufacturers = await prisma.organization.findMany({
    where: {
      type: "MANUFACTURER",
      status: "VERIFIED",
      ...(query ? { name: { contains: query } } : {}),
      ...(region ? { region } : {}),
      ...(category ? { products: { some: { category, isActive: true } } } : {}),
    },
    include: {
      _count: { select: { products: true } },
      products: { where: { isActive: true }, select: { category: true } },
      grantedAccess: { where: { stockistId: session.user.organizationId }, select: { id: true, status: true, message: true, requestedAt: true, decidedAt: true } },
    },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(manufacturers.map((manufacturer) => ({
    id: manufacturer.id,
    name: manufacturer.name,
    region: manufacturer.region,
    drugLicense: manufacturer.drugLicense,
    productCount: manufacturer._count.products,
    categories: [...new Set(manufacturer.products.map((product) => product.category))],
    access: manufacturer.grantedAccess[0] ?? null,
  })))
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "STOCKIST" || !session.user.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = requestSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid access request", details: parsed.error.flatten() }, { status: 400 })
  }

  const manufacturer = await prisma.organization.findFirst({
    where: { id: parsed.data.manufacturerId, type: "MANUFACTURER", status: "VERIFIED" },
  })
  if (!manufacturer) return NextResponse.json({ error: "Manufacturer not found" }, { status: 404 })

  const stockist = await prisma.organization.findFirst({
    where: { id: session.user.organizationId, type: "STOCKIST", status: "VERIFIED" },
  })
  if (!stockist) return NextResponse.json({ error: "Your business is not verified yet" }, { status: 403 })

  const existing = await prisma.accessGrant.findFirst({ where: { manufacturerId: manufacturer.id, stockistId: stockist.id } })
  if (existing?.status === "VERIFIED") return NextResponse.json({ error: "Access is already approved" }, { status: 409 })

  const grant = existing
    ? await prisma.accessGrant.update({ where: { id: existing.id }, data: { status: "PENDING", message: parsed.data.message, requestedAt: new Date(), decidedAt: null } })
    : await prisma.accessGrant.create({ data: { manufacturerId: manufacturer.id, stockistId: stockist.id, status: "PENDING", message: parsed.data.message } })

  await notify(prisma, {
    organizationId: manufacturer.id,
    type: "ACCESS_REQUEST",
    title: "New stockist access request",
    message: `${stockist.name} requested access${parsed.data.message ? `: ${parsed.data.message}` : "."}`,
    link: "/manufacturer/access-requests",
  })

  return NextResponse.json({ success: true, grant }, { status: existing ? 200 : 201 })
}
