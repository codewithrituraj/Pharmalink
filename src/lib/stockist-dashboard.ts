import { prisma } from "@/lib/prisma"
import { buildStockistInsights } from "@/lib/insights"
import { buildOutstandingLedger } from "@/lib/ledger"

export async function getStockistDashboard(stockistId: string, now = new Date()) {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const [insights, unpaid, attentionOrders, avoidedReturns] = await Promise.all([
    buildStockistInsights(stockistId),
    prisma.order.findMany({ where: { buyerId: stockistId, isPaid: false, invoiceNumber: { not: null } }, include: { seller: { select: { name: true } } }, orderBy: { invoiceCreatedAt: "asc" } }),
    prisma.order.findMany({ where: { buyerId: stockistId, status: { in: ["PLACED", "APPROVED", "PACKED", "DISPATCHED"] } }, include: { seller: { select: { name: true } } }, orderBy: { createdAt: "asc" }, take: 8 }),
    prisma.returnRequest.aggregate({ _sum: { total: true }, where: { buyerId: stockistId, status: { in: ["APPROVED", "CREDITED"] }, decidedAt: { gte: monthStart, lte: now }, reason: { in: ["EXPIRING", "EXPIRED"] } } }),
  ])
  const ledger = buildOutstandingLedger(unpaid, now)
  const reorders = insights.reorderRadar.filter(item => item.urgency !== "MONITOR").slice(0, 5)
  const expiry = insights.expiry.batches.filter(batch => batch.daysRemaining <= 90).slice(0, 5)
  const orders = attentionOrders.map(order => {
    const ageDays = Math.floor((now.getTime() - order.createdAt.getTime()) / 86_400_000)
    const delayed = Boolean(order.expectedDelivery && order.expectedDelivery < now && order.status !== "DELIVERED")
    const stuck = ageDays >= (order.status === "DISPATCHED" ? 7 : 3)
    return { id: order.id, poNumber: order.poNumber, manufacturer: order.seller.name, status: order.status, ageDays, delayed, stuck, reason: delayed ? "Expected delivery date has passed" : stuck ? `No status change visible for ${ageDays} days` : "Awaiting the next fulfilment update" }
  }).filter(order => order.delayed || order.stuck || order.status === "PLACED")

  return {
    generatedAt: now.toISOString(),
    reorders,
    expiry,
    ledger,
    orders,
    impact: {
      expiryRiskAvoided: Math.round((avoidedReturns._sum.total ?? 0) * 100) / 100,
      stockoutsPrevented: null as number | null,
      stockoutsNote: "Building up: this needs a completed reorder followed by the original predicted stock-out date.",
    },
  }
}
