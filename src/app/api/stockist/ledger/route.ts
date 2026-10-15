import { NextResponse } from "next/server"

import { requireRole } from "@/lib/access"
import { buildOutstandingLedger } from "@/lib/ledger"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const auth = await requireRole("STOCKIST")
  if ("error" in auth) return auth.error

  const orders = await prisma.order.findMany({
    where: {
      buyerId: auth.session.user.organizationId,
      isPaid: false,
      invoiceNumber: { not: null },
    },
    include: { seller: { select: { name: true } } },
    orderBy: { invoiceCreatedAt: "asc" },
  })

  return NextResponse.json(buildOutstandingLedger(orders))
}