import { NextResponse } from "next/server"

import { requireRole } from "@/lib/access"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const auth = await requireRole("ADMIN")
  if ("error" in auth) return auth.error

  const violations = await prisma.productPriceViolation.findMany({
    where: { active: true },
    include: {
      product: { select: { id: true, name: true, composition: true, packSize: true } },
      manufacturer: { select: { id: true, name: true } },
      reference: { select: { drugName: true, ceilingPrice: true, effectiveDate: true } },
    },
    orderBy: { detectedAt: "desc" },
  })

  return NextResponse.json(violations)
}