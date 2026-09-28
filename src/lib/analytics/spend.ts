import { monthKey, monthLabel, monthStart, addMonths } from "./dates"

export type SpendOrderInput = {
  id: string
  createdAt: Date
  total: number
  status: string
  sellerName: string
  items: { quantity: number; price: number; category: string }[]
}

export type SpendBucket = {
  label: string
  value: number
  share: number
  detail?: string
}

export type SpendReport = {
  generatedAt: string
  rangeLabel: string
  orderCount: number
  total: number
  /** Change against the immediately preceding window of the same length. */
  changePercent: number | null
  averageOrderValue: number
  previousTotal: number
  byMonth: (SpendBucket & { periodKey: string })[]
  byManufacturer: SpendBucket[]
  byCategory: SpendBucket[]
  topManufacturer: SpendBucket | null
  topCategory: SpendBucket | null
  assumptions: { label: string; value: string }[]
  notes: string[]
}

/** Orders that represent real procurement spend. */
const COUNTED_STATUSES = ["PLACED", "APPROVED", "PACKED", "DISPATCHED", "DELIVERED"]

function toBuckets(
  entries: Map<string, { value: number; count: number }>,
  total: number,
  detailFor?: (key: string, entry: { value: number; count: number }) => string | undefined,
): SpendBucket[] {
  return [...entries.entries()]
    .map(([key, entry]) => ({
      label: key,
      value: Math.round(entry.value * 100) / 100,
      share: total > 0 ? entry.value / total : 0,
      ...(detailFor ? { detail: detailFor(key, entry) } : {}),
    }))
    .sort((a, b) => b.value - a.value)
}

export function buildSpendReport(
  orders: SpendOrderInput[],
  options: { now?: Date; months?: number } = {},
): SpendReport {
  const now = options.now ?? new Date()
  const months = options.months ?? 12
  const counted = orders.filter((order) => COUNTED_STATUSES.includes(order.status))
  const current = monthStart(now)
  const windowStart = addMonths(current, -(months - 1))
  const previousWindowStart = addMonths(windowStart, -months)

  const inWindow = counted.filter((order) => order.createdAt >= windowStart)
  const total = inWindow.reduce((sum, order) => sum + order.total, 0)
  const previousTotal = counted
    .filter((order) => order.createdAt >= previousWindowStart && order.createdAt < windowStart)
    .reduce((sum, order) => sum + order.total, 0)

  const monthly = new Map<string, { value: number; count: number }>()
  const byManufacturer = new Map<string, { value: number; count: number }>()
  const byCategory = new Map<string, { value: number; count: number }>()

  for (let offset = months - 1; offset >= 0; offset -= 1) {
    monthly.set(monthKey(addMonths(current, -offset)), { value: 0, count: 0 })
  }

  for (const order of inWindow) {
    const key = monthKey(order.createdAt)
    const month = monthly.get(key) ?? { value: 0, count: 0 }
    month.value += order.total
    month.count += 1
    monthly.set(key, month)

    const manufacturer = byManufacturer.get(order.sellerName) ?? { value: 0, count: 0 }
    manufacturer.value += order.total
    manufacturer.count += 1
    byManufacturer.set(order.sellerName, manufacturer)

    for (const item of order.items) {
      const category = byCategory.get(item.category) ?? { value: 0, count: 0 }
      category.value += item.price * item.quantity
      category.count += item.quantity
      byCategory.set(item.category, category)
    }
  }

  const byMonth = [...monthly.entries()].map(([key, entry]) => {
    const periodStart = new Date(`${key}-01T00:00:00`)
    return {
      periodKey: key,
      label: monthLabel(periodStart),
      value: Math.round(entry.value * 100) / 100,
      share: total > 0 ? entry.value / total : 0,
      detail: `${entry.count} order${entry.count === 1 ? "" : "s"}`,
    }
  })

  const manufacturerBuckets = toBuckets(byManufacturer, total, (_key, entry) =>
    `${entry.count} order${entry.count === 1 ? "" : "s"}`,
  )
  const categoryBuckets = toBuckets(byCategory, total, (_key, entry) =>
    `${entry.count.toLocaleString("en-IN")} units`,
  )

  const changePercent =
    previousTotal > 0
      ? Math.round(((total - previousTotal) / previousTotal) * 1000) / 10
      : null

  return {
    generatedAt: now.toISOString(),
    rangeLabel: `${monthLabel(windowStart)} to ${monthLabel(current)}`,
    orderCount: inWindow.length,
    total: Math.round(total * 100) / 100,
    changePercent,
    averageOrderValue:
      inWindow.length > 0
        ? Math.round((total / inWindow.length) * 100) / 100
        : 0,
    previousTotal: Math.round(previousTotal * 100) / 100,
    byMonth,
    byManufacturer: manufacturerBuckets,
    byCategory: categoryBuckets,
    topManufacturer: manufacturerBuckets[0] ?? null,
    topCategory: categoryBuckets[0] ?? null,
    assumptions: [
      {
        label: "Included orders",
        value: `Placed, approved, packed, dispatched and delivered purchase orders`,
      },
      {
        label: "Excluded orders",
        value: "Rejected and cancelled purchase orders",
      },
      {
        label: "Basis",
        value: "Order total (subtotal − scheme discount + GST), grouped by order date",
      },
      {
        label: "Category split",
        value: "Line value (price × quantity) per product category, so it can differ slightly from the order total",
      },
      {
        label: "Comparison window",
        value: `Change is measured against the previous ${months} months`,
      },
    ],
    notes: [
      "Spend analytics reflect purchase orders placed in PharmaLink only; purchases made outside the platform are not included.",
    ],
  }
}
