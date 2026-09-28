import { addDays, toDateInputValue } from "./dates"

export type ReorderInput = {
  productId: string
  productName: string
  genericName: string
  manufacturerId: string
  manufacturerName: string
  unitPrice: number
  minOrderQty: number
  leadTimeDays: number
  onHand: number
  /** Units already committed to an open purchase order. */
  onOrder: number
  averageMonthly: number
  forecastMonthly: number | null
  dailyConsumption: number | null
  daysOfCover: number | null
  stockOutRisk: string
}

export type ReorderRecommendation = {
  productId: string
  productName: string
  genericName: string
  manufacturerId: string
  manufacturerName: string
  onHand: number
  onOrder: number
  averageMonthly: number
  forecastMonthly: number | null
  /** Units below which a new order should already be placed. */
  reorderPoint: number | null
  /** Stock level the recommendation aims to restore. */
  targetStock: number
  suggestedQuantity: number
  estimatedCost: number
  unitPrice: number
  minOrderQty: number
  /** "ORDER_NOW", "ORDER_SOON" or "MONITOR". */
  urgency: "ORDER_NOW" | "ORDER_SOON" | "MONITOR"
  urgencyLabel: string
  timing: string
  orderByDate: string | null
  daysOfCover: number | null
  /** Plain-language rationale, e.g. "Average monthly requirement 500, current stock 120". */
  reason: string
  inputs: { label: string; value: string }[]
}

export const REVIEW_WINDOW_DAYS = 30
const SAFETY_FACTOR = 1.5

function roundUpToMultiple(value: number, multiple: number) {
  if (multiple <= 1) return Math.ceil(value)
  return Math.ceil(value / multiple) * multiple
}

/**
 * Turns a forecast into an actionable reorder proposal.
 *
 * Reorder point = daily consumption x supplier lead time x a 1.5 safety factor.
 * Target stock covers the lead time plus one 30-day review window, and the gap
 * is rounded up to a whole multiple of the product's minimum order quantity.
 */
export function buildReorderRecommendation(
  input: ReorderInput,
  now = new Date(),
): ReorderRecommendation {
  const dailyConsumption = input.dailyConsumption
  const minOrderQty = Math.max(1, input.minOrderQty)
  const reorderPoint =
    dailyConsumption && dailyConsumption > 0
      ? Math.ceil(dailyConsumption * input.leadTimeDays * SAFETY_FACTOR)
      : null
  const targetStock =
    dailyConsumption && dailyConsumption > 0
      ? Math.ceil(dailyConsumption * (input.leadTimeDays + REVIEW_WINDOW_DAYS))
      : input.onHand

  const effectiveStock = input.onHand + input.onOrder
  const rawGap = targetStock - effectiveStock
  const suggestedQuantity = Math.max(minOrderQty, roundUpToMultiple(rawGap, minOrderQty))
  const hasHistory = input.dailyConsumption !== null && input.dailyConsumption > 0
  const belowReorderPoint = reorderPoint !== null && effectiveStock <= reorderPoint

  let urgency: ReorderRecommendation["urgency"] = "MONITOR"
  if (!hasHistory) urgency = "MONITOR"
  else if (input.stockOutRisk === "OUT" || belowReorderPoint) urgency = "ORDER_NOW"
  else if (rawGap > 0) urgency = "ORDER_SOON"

  const urgencyLabel =
    urgency === "ORDER_NOW"
      ? "Order now"
      : urgency === "ORDER_SOON"
        ? "Order soon"
        : "Monitor"

  const orderByDate = hasHistory
    ? toDateInputValue(addDays(now, input.leadTimeDays))
    : null

  const timing =
    urgency === "ORDER_NOW"
      ? `Place this order now — a fresh batch takes about ${input.leadTimeDays} day${input.leadTimeDays === 1 ? "" : "s"} to arrive.`
      : urgency === "ORDER_SOON"
        ? `Plan this order for the next review cycle (by ${orderByDate}).`
        : hasHistory
          ? `No action needed — stock covers the next ${input.daysOfCover ?? 0} days.`
          : "Waiting on demand history before a quantity can be suggested."

  const reason = hasHistory
    ? `Average monthly requirement ${input.averageMonthly.toLocaleString("en-IN")}, current stock ${input.onHand.toLocaleString("en-IN")}${
        input.onOrder > 0 ? ` (${input.onOrder.toLocaleString("en-IN")} already on order)` : ""
      }. Forecast ${input.forecastMonthly ?? 0} units next month against a lead time of ${input.leadTimeDays} days, so the reorder point is ${reorderPoint} units.`
    : "Not enough delivered order history yet for this product, so the quantity is the minimum order quantity. It will improve after the next delivery."

  const inputs = [
    { label: "Average monthly requirement", value: `${input.averageMonthly.toLocaleString("en-IN")} units` },
    { label: "Forecast next month", value: input.forecastMonthly === null ? "Not available" : `${input.forecastMonthly.toLocaleString("en-IN")} units` },
    { label: "Estimated daily consumption", value: hasHistory ? `${Math.round((dailyConsumption ?? 0) * 10) / 10} units/day` : "Not available" },
    { label: "Current stock", value: `${input.onHand.toLocaleString("en-IN")} units` },
    { label: "Already on order", value: `${input.onOrder.toLocaleString("en-IN")} units` },
    { label: "Supplier lead time", value: `${input.leadTimeDays} days` },
    { label: "Safety factor", value: `${SAFETY_FACTOR}x on the reorder point` },
    { label: "Review window", value: `${REVIEW_WINDOW_DAYS} days` },
    { label: "Minimum order quantity", value: `${minOrderQty} units` },
  ]

  return {
    productId: input.productId,
    productName: input.productName,
    genericName: input.genericName,
    manufacturerId: input.manufacturerId,
    manufacturerName: input.manufacturerName,
    onHand: input.onHand,
    onOrder: input.onOrder,
    averageMonthly: input.averageMonthly,
    forecastMonthly: input.forecastMonthly,
    reorderPoint,
    targetStock,
    suggestedQuantity,
    estimatedCost: Math.round(suggestedQuantity * input.unitPrice * 100) / 100,
    unitPrice: input.unitPrice,
    minOrderQty,
    urgency,
    urgencyLabel,
    timing,
    orderByDate,
    daysOfCover: input.daysOfCover,
    reason,
    inputs,
  }
}

export const REORDER_URGENCY_VARIANT: Record<
  ReorderRecommendation["urgency"],
  "destructive" | "secondary" | "outline"
> = {
  ORDER_NOW: "destructive",
  ORDER_SOON: "secondary",
  MONITOR: "outline",
}
