import type { Prisma } from "@prisma/client"

type DeliverableOrder = {
  id: string
  buyerId: string
  items: Array<{
    productId: string
    quantity: number
    allocations: Array<{
      quantity: number
      batch: {
        batchNumber: string
        mfgDate: Date | null
        expiryDate: Date
      }
    }>
  }>
}

/** Records the durable stock and demand effects of one delivery exactly once. */
export async function recordOrderDelivery(
  tx: Prisma.TransactionClient,
  order: DeliverableOrder,
  deliveredAt = new Date(),
) {
  const existing = await tx.inventoryBatch.count({ where: { sourceOrderId: order.id } })
  if (existing > 0) throw new Error("This order has already been received into inventory")

  const periodStart = new Date(deliveredAt)
  periodStart.setDate(1)
  periodStart.setHours(0, 0, 0, 0)

  for (const item of order.items) {
    if (item.allocations.length > 0) {
      await tx.inventoryBatch.createMany({
        data: item.allocations.map((allocation) => ({
          stockistId: order.buyerId,
          productId: item.productId,
          batchNumber: allocation.batch.batchNumber,
          quantity: allocation.quantity,
          mfgDate: allocation.batch.mfgDate,
          expiryDate: allocation.batch.expiryDate,
          receivedAt: deliveredAt,
          sourceOrderId: order.id,
        })),
      })
    }

    await tx.demandSample.upsert({
      where: {
        stockistId_productId_periodStart: {
          stockistId: order.buyerId,
          productId: item.productId,
          periodStart,
        },
      },
      update: { quantity: { increment: item.quantity } },
      create: {
        stockistId: order.buyerId,
        productId: item.productId,
        periodStart,
        quantity: item.quantity,
        source: "DELIVERED_ORDER",
      },
    })
  }
}
