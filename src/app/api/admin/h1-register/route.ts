import { NextResponse } from "next/server"

import { requireRole } from "@/lib/access"
import { h1RegisterFilterSchema, h1RegisterWhere } from "@/lib/h1-register"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const auth = await requireRole("ADMIN")
  if ("error" in auth) return auth.error

  const filters = h1RegisterFilterSchema.safeParse(Object.fromEntries(new URL(req.url).searchParams))
  if (!filters.success) return NextResponse.json({ error: "Invalid H1 register filters" }, { status: 400 })

  const entries = await prisma.h1RegisterEntry.findMany({
    where: h1RegisterWhere(filters.data),
    include: {
      buyer: { select: { id: true, name: true, drugLicense: true } },
      product: { select: { id: true, name: true, genericName: true, strength: true, packSize: true } },
      order: { select: { id: true, poNumber: true } },
    },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(entries)
}