import { addDays, daysBetween, toDateInputValue } from "./dates"

export type ExpiryBand = "EXPIRED" | "WITHIN_30" | "WITHIN_60" | "WITHIN_90" | "LATER"

export type ExpiryAction =
  | "DISPOSE"
  | "SELL_FIRST"
  | "RETURN_OR_CREDIT"
  | "DO_NOT_REORDER"
  | "MONITOR"

export type ExpiryBatchInput = {
  id: string
  productId: string
  productName: string
  genericName: string
  manufacturerName: string
  batchNumber: string
  quantity: number
  expiryDate: Date
  receivedAt: Date
  sourceOrderId: string | null
  unitPrice: number
  minOrderQty: number
  leadTimeDays: number
}

export type ExpiryBatch = {
  id: string
  productId: string
  productName: string
  genericName: string
  manufacturerName: string
  batchNumber: string
  quantity: number
  expiryDate: string
  receivedDate: string
  daysRemaining: number
  band: ExpiryBand
  bandLabel: string
  action: ExpiryAction
  actionLabel: string
  reason: string
  /** Position in the first-expiry-first-out sell-down order for the product. */
  fefoRank: number
  /** Units still expected to be on hand on the expiry date at current demand. */
  unitsAtRisk: number
  valueAtRisk: number
  dailyConsumption: number | null
  daysOfCover: number | null
  source: "DELIVERY" | "MANUAL"
}

export type ExpiryReport = {
  generatedAt: string
  horizonDays: number
  totals: {
    batches: number
    units: number
    within30: number
    within60: number
    within90: number
    expired: number
    unitsAtRisk: number
    valueAtRisk: number
  }
  counts: Record<ExpiryBand, number>
  batches: ExpiryBatch[]
  assumptions: { label: string; value: string }[]
  notes: string[]
}

export const EXPIRY_HORIZON_DAYS = 90

export const EXPIRY_BAND_LABEL: Record<ExpiryBand, string> = {
  EXPIRED: "Already expired",
  WITHIN_30: "Within 30 days",
  WITHIN_60: "31 to 60 days",
  WITHIN_90: "61 to 90 days",
  LATER: "More than 90 days",
}

export const EXPIRY_ACTION_LABEL: Record<ExpiryAction, string> = {
  DISPOSE: "Quarantine and return",
  SELL_FIRST: "Sell first",
  RETURN_OR_CREDIT: "Return or claim credit",
  DO_NOT_REORDER: "Do not reorder",
  MONITOR: "Monitor",
}

function bandFor(daysRemaining: number): ExpiryBand {
  if (daysRemaining <= 0) return "EXPIRED"
  if (daysRemaining <= 30) return "WITHIN_30"
  if (daysRemaining <= 60) return "WITHIN_60"
  if (daysRemaining <= 90) return "WITHIN_90"
  return "LATER"
}

export type ExpiryBatchRecord = ExpiryBatchInput

function buildBatchRow(
  batch: ExpiryBatchRecord,
  context: {
    now: Date
    dailyConsumption: number | null
    daysOfCover: number | null
    fefoRank: number
    /**
     * Units of this batch already absorbed by demand that ran through the
     * batches that expire before it. FEFO means later batches inherit the
     * sell-down that earlier batches did not absorb.
     */
    carryUnits: number
  },
): ExpiryBatch {
  const { now, dailyConsumption, daysOfCover, fefoRank, carryUnits } = context
  const daysRemaining = daysBetween(now, batch.expiryDate)
  const band = bandFor(daysRemaining)

  // First-expiry-first-out: demand is absorbed by the batch that expires
  // soonest, so a later batch only carries risk once everything expiring
  // before it has already been consumed.
  const available = Math.max(0, batch.quantity - carryUnits)
  const demandUntilExpiry =
    dailyConsumption === null || daysRemaining <= 0
      ? 0
      : dailyConsumption * daysRemaining
  const unitsAtRisk = dailyConsumption === null
    ? batch.quantity
    : Math.max(0, Math.min(available, available - demandUntilExpiry))
  const valueAtRisk = Math.round(unitsAtRisk * batch.unitPrice * 100) / 100

  let action: ExpiryAction = "MONITOR"
  let reason = ""

  if (band === "EXPIRED") {
    action = "DISPOSE"
    reason = `Expired ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? "" : "s"} ago. Pull ${batch.quantity} units from saleable stock and follow your returns policy.`
  } else if (dailyConsumption === null) {
    action = daysRemaining <= 60 ? "SELL_FIRST" : "MONITOR"
    reason = daysRemaining <= 60
      ? `Expires in ${daysRemaining} days and there is no demand history to confirm a sell-down. Prioritise this batch manually.`
      : `Expires in ${daysRemaining} days. Record some demand to model the sell-down rate.`
  } else if (unitsAtRisk === 0) {
    action = "MONITOR"
    reason = `At ${Math.round(dailyConsumption)} units/day, FEFO clears this batch before ${Math.round(daysRemaining / 30)} month${Math.round(daysRemaining / 30) === 1 ? "" : "s"} of cover.`
  } else if (daysRemaining <= 30) {
    action = "RETURN_OR_CREDIT"
    reason = `${unitsAtRisk} of ${batch.quantity} units will still be on hand at expiry. Raise a return or credit note within ${daysRemaining} days.`
  } else if (daysOfCover !== null && daysOfCover > 150) {
    action = "DO_NOT_REORDER"
    reason = `You hold ${daysOfCover} days of cover, so ${unitsAtRisk} units will expire unsold. Hold off on reordering this product.`
  } else {
    action = "SELL_FIRST"
    reason = `About ${unitsAtRisk} units may expire unsold. Sell this batch before later ones (FEFO) or bundle it into a promotion.`
  }

  return {
    id: batch.id,
    productId: batch.productId,
    productName: batch.productName,
    genericName: batch.genericName,
    manufacturerName: batch.manufacturerName,
    batchNumber: batch.batchNumber,
    quantity: batch.quantity,
    expiryDate: toDateInputValue(batch.expiryDate),
    receivedDate: toDateInputValue(batch.receivedAt),
    daysRemaining,
    band,
    bandLabel: EXPIRY_BAND_LABEL[band],
    action,
    actionLabel: EXPIRY_ACTION_LABEL[action],
    reason,
    fefoRank,
    unitsAtRisk,
    valueAtRisk,
    dailyConsumption: dailyConsumption === null ? null : Math.round(dailyConsumption * 10) / 10,
    daysOfCover,
    source: batch.sourceOrderId ? ("DELIVERY" as const) : ("MANUAL" as const),
  }
}

export function buildExpiryReport(
  batches: ExpiryBatchRecord[],
  options: {
    now?: Date
    horizonDays?: number
    /** Forecast daily consumption per product, used to project the FEFO sell-down. */
    dailyConsumptionByProduct?: Map<string, number>
  } = {},
): ExpiryReport {
  const now = options.now ?? new Date()
  const horizonDays = options.horizonDays ?? EXPIRY_HORIZON_DAYS
  const dailyConsumptionByProduct = options.dailyConsumptionByProduct ?? new Map<string, number>()

  const byProduct = new Map<string, ExpiryBatchRecord[]>()
  for (const batch of batches) {
    const list = byProduct.get(batch.productId) ?? []
    list.push(batch)
    byProduct.set(batch.productId, list)
  }

  const rows: ExpiryBatch[] = []
  for (const [productId, productBatches] of byProduct.entries()) {
    // FEFO ordering: soonest expiry first, ties broken by oldest receipt.
    const ordered = [...productBatches].sort(
      (a, b) =>
        a.expiryDate.getTime() - b.expiryDate.getTime() ||
        a.receivedAt.getTime() - b.receivedAt.getTime(),
    )
    const dailyConsumption = dailyConsumptionByProduct.get(productId) ?? null
    const totalStock = productBatches.reduce((sum, batch) => sum + batch.quantity, 0)
    const daysOfCover =
      dailyConsumption && dailyConsumption > 0
        ? Math.floor(totalStock / dailyConsumption)
        : null

    let carryUnits = 0
    ordered.forEach((batch, index) => {
      const row = buildBatchRow(batch, {
        now,
        dailyConsumption,
        daysOfCover,
        fefoRank: index + 1,
        carryUnits,
      })
      rows.push(row)
      // Whatever this batch does not absorb before it expires is stock the
      // next batch's demand will consume first.
      carryUnits = dailyConsumption === null ? 0 : row.unitsAtRisk
    })
  }

  rows.sort(
    (a, b) =>
      new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime() ||
      a.productName.localeCompare(b.productName),
  )

  const counts: Record<ExpiryBand, number> = {
    EXPIRED: 0,
    WITHIN_30: 0,
    WITHIN_60: 0,
    WITHIN_90: 0,
    LATER: 0,
  }
  for (const row of rows) counts[row.band] += 1

  const horizonRows = rows.filter(
    (row) => row.daysRemaining <= horizonDays || row.daysRemaining < 0,
  )

  return {
    generatedAt: now.toISOString(),
    horizonDays,
    totals: {
      batches: rows.length,
      units: rows.reduce((sum, row) => sum + row.quantity, 0),
      within30: rows.filter((row) => row.daysRemaining > 0 && row.daysRemaining <= 30).length,
      within60: rows.filter((row) => row.daysRemaining > 0 && row.daysRemaining <= 60).length,
      within90: rows.filter((row) => row.daysRemaining > 0 && row.daysRemaining <= 90).length,
      expired: counts.EXPIRED,
      unitsAtRisk: horizonRows.reduce((sum, row) => sum + row.unitsAtRisk, 0),
      valueAtRisk: Math.round(horizonRows.reduce((sum, row) => sum + row.valueAtRisk, 0) * 100) / 100,
    },
    counts,
    batches: rows,
    assumptions: [
      {
        label: "Ordering",
        value: "First-Expiry-First-Out: batches are ranked by earliest expiry date, then oldest receipt",
      },
      {
        label: "Sell-down rate",
        value: "Each product's forecast monthly demand converted to units per day",
      },
      {
        label: "Watch window",
        value: `${horizonDays} days from today, plus any batch already past expiry`,
      },
      {
        label: "Valuation",
        value: "Units at risk are valued at the product's current PTR",
      },
    ],
    notes: [
      "Suggested actions are planning guidance for your team. Return windows, storage conditions and regulatory rules are set by the manufacturer and your own quality policy.",
      "A batch is flagged as at risk when current demand will not clear it before its expiry date.",
    ],
  }
}

export function stockOutDate(daysOfCover: number, now = new Date()) {
  if (!Number.isFinite(daysOfCover)) return null
  return addDays(now, Math.max(0, Math.floor(daysOfCover)))
}
