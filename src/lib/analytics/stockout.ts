import { addDays, toDateInputValue } from "./dates"

export type StockOutRisk = "OUT" | "CRITICAL" | "LOW" | "HEALTHY" | "NO_HISTORY"

export type StockOutInput = {
  productId: string
  productName: string
  genericName: string
  manufacturerName: string
  unitPrice: number
  minOrderQty: number
  leadTimeDays: number
  onHand: number
  dailyConsumption: number | null
  forecastMonthly: number | null
  expiryBufferDays: number
}

export type StockOutAssessment = {
  productId: string
  productName: string
  genericName: string
  manufacturerName: string
  onHand: number
  dailyConsumption: number | null
  daysOfCover: number | null
  /** Plain-language stock-out statement, e.g. "Stock may run out in ~12 days". */
  headline: string
  stockOutDate: string | null
  risk: StockOutRisk
  riskLabel: string
  leadTimeDays: number
  /** True when the product runs out before a fresh order could arrive. */
  belowLeadTime: boolean
  detail: string
}

export const STOCK_OUT_RISK_LABEL: Record<StockOutRisk, string> = {
  OUT: "Out of stock",
  CRITICAL: "Critical",
  LOW: "Watch",
  HEALTHY: "Healthy",
  NO_HISTORY: "No demand history",
}

function riskFor(daysOfCover: number | null, onHand: number, leadTimeDays: number): StockOutRisk {
  if (daysOfCover === null) return "NO_HISTORY"
  if (daysOfCover <= 0 || onHand <= 0) return "OUT"
  if (daysOfCover <= leadTimeDays) return "CRITICAL"
  if (daysOfCover <= leadTimeDays * 3) return "LOW"
  return "HEALTHY"
}

export function assessStockOut(
  input: StockOutInput,
  now = new Date(),
): StockOutAssessment {
  const dailyConsumption = input.dailyConsumption
  const daysOfCover =
    dailyConsumption && dailyConsumption > 0
      ? Math.floor(input.onHand / dailyConsumption)
      : null
  const risk = riskFor(daysOfCover, input.onHand, input.leadTimeDays)
  const stockOutDate =
    daysOfCover === null ? null : toDateInputValue(addDays(now, daysOfCover))
  const belowLeadTime = daysOfCover !== null && daysOfCover <= input.leadTimeDays

  const headline =
    daysOfCover === null
      ? "No demand history to estimate a stock-out date"
      : daysOfCover <= 0
        ? `Out of stock — ${input.onHand === 0 ? "nothing on hand" : "no cover left"}`
        : `Stock may run out in ~${daysOfCover} day${daysOfCover === 1 ? "" : "s"}`

  const detail =
    daysOfCover === null
      ? "Record at least one delivered order for this product to enable a stock-out estimate."
      : `${input.onHand.toLocaleString("en-IN")} units on hand against an estimated ${Math.round((dailyConsumption ?? 0) * 10) / 10} units/day of consumption. A fresh order takes about ${input.leadTimeDays} day${input.leadTimeDays === 1 ? "" : "s"} to arrive.`

  return {
    productId: input.productId,
    productName: input.productName,
    genericName: input.genericName,
    manufacturerName: input.manufacturerName,
    onHand: input.onHand,
    dailyConsumption:
      dailyConsumption === null ? null : Math.round(dailyConsumption * 10) / 10,
    daysOfCover,
    headline,
    stockOutDate,
    risk,
    riskLabel: STOCK_OUT_RISK_LABEL[risk],
    leadTimeDays: input.leadTimeDays,
    belowLeadTime,
    detail,
  }
}
