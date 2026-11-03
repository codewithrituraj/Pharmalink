import { NextResponse } from "next/server"

import { buildInvoiceSummary } from "@/lib/invoices"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/access"

export async function GET(req: Request) {
  const auth = await requireRole("STOCKIST")
  if ("error" in auth) return auth.error

  const { searchParams } = new URL(req.url)
  const manufacturerId = searchParams.get("manufacturerId")
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  const where: Record<string, unknown> = {
    buyerId: auth.session.user.organizationId,
    invoiceNumber: { not: null },
  }

  if (manufacturerId) {
    where.sellerId = manufacturerId
  }

  if (from || to) {
    where.invoiceCreatedAt = {}
    if (from) {
      ;(where.invoiceCreatedAt as Record<string, Date>).gte = new Date(`${from}T00:00:00.000Z`)
    }
    if (to) {
      ;(where.invoiceCreatedAt as Record<string, Date>).lte = new Date(`${to}T23:59:59.999Z`)
    }
  }

  const invoices = await prisma.order.findMany({
    where,
    include: {
      seller: { select: { name: true } },
      buyer: { select: { name: true } },
      items: {
        include: {
          product: { select: { name: true, hsnCode: true } },
        },
      },
    },
    orderBy: { invoiceCreatedAt: "desc" },
  })

  return NextResponse.json(invoices.map(buildInvoiceSummary))
}
