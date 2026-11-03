import { prisma } from "@/lib/prisma"
import { buildForecast, type Forecast } from "@/lib/analytics/forecast"
import {
  buildExpiryReport,
  type ExpiryBatchRecord,
  type ExpiryReport,
} from "@/lib/analytics/expiry"
import { assessStockOut, type StockOutAssessment } from "@/lib/analytics/stockout"
import {
  buildReorderRecommendation,
  type ReorderRecommendation,
} from "@/lib/analytics/reorder"
import { buildSpendReport, type SpendReport } from "@/lib/analytics/spend"

const OPEN_ORDER_STATUSES = ["PLACED", "APPROVED", "PACKED", "DISPATCHED"]
const COUNTED_SPEND_STATUSES = ["PLACED", "APPROVED", "PACKED", "DISPATCHED", "DELIVERED"]

export type StockistProductContext = {
  productId: string
  productName: string
  genericName: string
  category: string
  manufacturerId: string
  manufacturerName: string
  unitPrice: number
  minOrderQty: number
  leadTimeDays: number
  isActive: boolean
  inventoryBatches: {
    id: string
    batchNumber: string
    quantity: number
    expiryDate: Date
    receivedAt: Date
    sourceOrderId: string | null
  }[]
  demandSamples: { periodStart: Date; quantity: number }[]
  openOrderQuantity: number
}

export type ProductInsight = {
  productId: string
  productName: string
  genericName: string
  category: string
  manufacturerId: string
  manufacturerName: string
  unitPrice: number
  minOrderQty: number
  leadTimeDays: number
  onHand: number
  onOrder: number
  batchCount: number
  earliestExpiry: string | null
  forecast: Forecast
  stockOut: StockOutAssessment
  reorder: ReorderRecommendation
}

export type StockistInsights = {
  generatedAt: string
  authorizedManufacturers: number
  productCount: number
  productsWithHistory: number
  products: ProductInsight[]
  expiry: ExpiryReport
  reorderRadar: ReorderRecommendation[]
  stockOutWatch: StockOutAssessment[]
  spend: SpendReport
  procurement: {
    allTime: number
    last12Months: number
    changePercent: number | null
    orderCount: number
  }
  inventory: {
    totalUnits: number
    totalBatches: number
    productCount: number
    expiringUnits: number
  }
}

/** Loads every product the stockist is authorized to buy, with the data the
 *  insights need, in a single round trip. */
export async function getStockistProductContexts(
  stockistId: string,
): Promise<StockistProductContext[]> {
  const grants = await prisma.accessGrant.findMany({
    where: { stockistId, status: "VERIFIED" },
    select: { manufacturerId: true },
  })
  const manufacturerIds = grants.map((grant) => grant.manufacturerId)
  if (manufacturerIds.length === 0) return []

  const products = await prisma.product.findMany({
    where: { manufacturerId: { in: manufacturerIds }, isActive: true },
    select: {
      id: true,
      name: true,
      genericName: true,
      category: true,
      manufacturerId: true,
      ptr: true,
      minOrderQty: true,
      leadTimeDays: true,
      isActive: true,
      manufacturer: { select: { name: true } },
      inventoryBatches: {
        where: { stockistId, quantity: { gt: 0 } },
        select: {
          id: true,
          batchNumber: true,
          quantity: true,
          expiryDate: true,
          receivedAt: true,
          sourceOrderId: true,
        },
      },
      demandSamples: {
        where: { stockistId },
        select: { periodStart: true, quantity: true },
        orderBy: { periodStart: "asc" },
      },
      orderItems: {
        where: { order: { buyerId: stockistId, status: { in: OPEN_ORDER_STATUSES } } },
        select: { quantity: true },
      },
    },
    orderBy: { name: "asc" },
  })

  return products.map((product) => ({
    productId: product.id,
    productName: product.name,
    genericName: product.genericName,
    category: product.category,
    manufacturerId: product.manufacturerId,
    manufacturerName: product.manufacturer.name,
    unitPrice: product.ptr,
    minOrderQty: product.minOrderQty,
    leadTimeDays: product.leadTimeDays,
    isActive: product.isActive,
    inventoryBatches: product.inventoryBatches,
    demandSamples: product.demandSamples,
    openOrderQuantity: product.orderItems.reduce((sum, item) => sum + item.quantity, 0),
  }))
}

export function buildProductInsight(
  context: StockistProductContext,
  now = new Date(),
): ProductInsight {
  const onHand = context.inventoryBatches.reduce(
    (sum, batch) => sum + batch.quantity,
    0,
  )
  const forecast = buildForecast(context.demandSamples, { now })

  const stockOut = assessStockOut(
    {
      productId: context.productId,
      productName: context.productName,
      genericName: context.genericName,
      manufacturerName: context.manufacturerName,
      unitPrice: context.unitPrice,
      minOrderQty: context.minOrderQty,
      leadTimeDays: context.leadTimeDays,
      onHand,
      dailyConsumption: forecast.dailyConsumption,
      forecastMonthly: forecast.forecastMonthly,
      expiryBufferDays: 0,
    },
    now,
  )

  const reorder = buildReorderRecommendation(
    {
      productId: context.productId,
      productName: context.productName,
      genericName: context.genericName,
      manufacturerId: context.manufacturerId,
      manufacturerName: context.manufacturerName,
      unitPrice: context.unitPrice,
      minOrderQty: context.minOrderQty,
      leadTimeDays: context.leadTimeDays,
      onHand,
      onOrder: context.openOrderQuantity,
      averageMonthly: forecast.averageMonthly,
      forecastMonthly: forecast.forecastMonthly,
      dailyConsumption: forecast.dailyConsumption,
      daysOfCover: stockOut.daysOfCover,
      stockOutRisk: stockOut.risk,
    },
    now,
  )

  const earliestExpiry =
    context.inventoryBatches.length > 0
      ? context.inventoryBatches
          .map((batch) => batch.expiryDate)
          .sort((a, b) => a.getTime() - b.getTime())[0]
      : null

  return {
    productId: context.productId,
    productName: context.productName,
    genericName: context.genericName,
    category: context.category,
    manufacturerId: context.manufacturerId,
    manufacturerName: context.manufacturerName,
    unitPrice: context.unitPrice,
    minOrderQty: context.minOrderQty,
    leadTimeDays: context.leadTimeDays,
    onHand,
    onOrder: context.openOrderQuantity,
    batchCount: context.inventoryBatches.length,
    earliestExpiry: earliestExpiry ? earliestExpiry.toISOString() : null,
    forecast,
    stockOut,
    reorder,
  }
}

function toExpiryRecords(
  contexts: StockistProductContext[],
): ExpiryBatchRecord[] {
  return contexts.flatMap((context) =>
    context.inventoryBatches.map((batch) => ({
      id: batch.id,
      productId: context.productId,
      productName: context.productName,
      genericName: context.genericName,
      manufacturerName: context.manufacturerName,
      batchNumber: batch.batchNumber,
      quantity: batch.quantity,
      expiryDate: batch.expiryDate,
      receivedAt: batch.receivedAt,
      sourceOrderId: batch.sourceOrderId,
      unitPrice: context.unitPrice,
      minOrderQty: context.minOrderQty,
      leadTimeDays: context.leadTimeDays,
    })),
  )
}

export async function buildStockistInsights(
  stockistId: string,
  options: { now?: Date; months?: number } = {},
): Promise<StockistInsights> {
  const now = options.now ?? new Date()
  const contexts = await getStockistProductContexts(stockistId)
  const products = contexts.map((context) => buildProductInsight(context, now))

  const dailyConsumptionByProduct = new Map<string, number>()
  for (const product of products) {
    if (product.forecast.dailyConsumption !== null) {
      dailyConsumptionByProduct.set(product.productId, product.forecast.dailyConsumption)
    }
  }

  const expiry = buildExpiryReport(toExpiryRecords(contexts), {
    now,
    dailyConsumptionByProduct,
  })

  const urgencyRank = { ORDER_NOW: 0, ORDER_SOON: 1, MONITOR: 2 }
  const reorderRadar = [...products]
    .map((product) => product.reorder)
    .sort(
      (a, b) =>
        urgencyRank[a.urgency] - urgencyRank[b.urgency] ||
        (a.daysOfCover ?? Number.MAX_SAFE_INTEGER) -
          (b.daysOfCover ?? Number.MAX_SAFE_INTEGER),
    )
    .slice(0, 8)

  const riskRank = { OUT: 0, CRITICAL: 1, LOW: 2, NO_HISTORY: 3, HEALTHY: 4 }
  const stockOutWatch = [...products]
    .map((product) => product.stockOut)
    .filter((assessment) => assessment.risk !== "HEALTHY")
    .sort(
      (a, b) =>
        riskRank[a.risk] - riskRank[b.risk] ||
        (a.daysOfCover ?? Number.MAX_SAFE_INTEGER) -
          (b.daysOfCover ?? Number.MAX_SAFE_INTEGER),
    )
    .slice(0, 8)

  const [orders, allTimeSpend, manufacturerCount] = await Promise.all([
    prisma.order.findMany({
      where: { buyerId: stockistId, status: { in: COUNTED_SPEND_STATUSES } },
      select: {
        id: true,
        createdAt: true,
        total: true,
        status: true,
        seller: { select: { name: true } },
        items: { select: { quantity: true, price: true, product: { select: { category: true } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.order.aggregate({
      where: { buyerId: stockistId, status: { in: COUNTED_SPEND_STATUSES } },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.accessGrant.count({ where: { stockistId, status: "VERIFIED" } }),
  ])

  const spend = buildSpendReport(
    orders.map((order) => ({
      id: order.id,
      createdAt: order.createdAt,
      total: order.total,
      status: order.status,
      sellerName: order.seller.name,
      items: order.items.map((item) => ({
        quantity: item.quantity,
        price: item.price,
        category: item.product.category,
      })),
    })),
    { now, months: options.months ?? 12 },
  )

  const allTime = Math.round((allTimeSpend._sum.total ?? 0) * 100) / 100
  const totalUnits = products.reduce((sum, product) => sum + product.onHand, 0)
  const totalBatches = products.reduce((sum, product) => sum + product.batchCount, 0)
  const expiringUnits = expiry.batches
    .filter((batch) => batch.daysRemaining <= 90)
    .reduce((sum, batch) => sum + batch.quantity, 0)

  return {
    generatedAt: now.toISOString(),
    authorizedManufacturers: manufacturerCount,
    productCount: products.length,
    productsWithHistory: products.filter(
      (product) => product.forecast.sampleMonths > 0,
    ).length,
    products,
    expiry,
    reorderRadar,
    stockOutWatch,
    spend,
    procurement: {
      allTime,
      last12Months: spend.total,
      changePercent: spend.changePercent,
      orderCount: allTimeSpend._count._all,
    },
    inventory: {
      totalUnits,
      totalBatches,
      productCount: products.filter((product) => product.onHand > 0).length,
      expiringUnits,
    },
  }
}

export async function getProductInsight(
  stockistId: string,
  productId: string,
  now = new Date(),
): Promise<ProductInsight | null> {
  const context = (await getStockistProductContexts(stockistId)).find((candidate) => candidate.productId === productId)
  return context ? buildProductInsight(context, now) : null
}

/** Per-product daily consumption, used by the expiry FEFO projection. */
export async function getDailyConsumptionMap(stockistId: string, now = new Date()) {
  const contexts = await getStockistProductContexts(stockistId)
  const map = new Map<string, number>()
  for (const context of contexts) {
    const forecast = buildForecast(context.demandSamples, { now })
    if (forecast.dailyConsumption !== null) {
      map.set(context.productId, forecast.dailyConsumption)
    }
  }
  return map
}
