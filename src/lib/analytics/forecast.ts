import { addMonths, monthKey, monthLabel, monthName, monthStart } from "./dates"

export type DemandSampleInput = {
  periodStart: Date
  quantity: number
}

export type ForecastPoint = {
  periodKey: string
  label: string
  /** Recorded demand. `null` for future periods. */
  actual: number | null
  /** Model estimate. `null` when there is not enough history. */
  forecast: number | null
  /** Lower bound of the 80% prediction band. */
  lowerBound: number | null
  /** Upper bound of the 80% prediction band. */
  upperBound: number | null
}

export type SeasonalIndex = {
  month: number
  monthName: string
  index: number
  observations: number
}

export type ForecastConfidence = "LOW" | "MEDIUM" | "HIGH"

export type ForecastMethod =
  | "WEIGHTED_MOVING_AVERAGE"
  | "SIMPLE_AVERAGE"
  | "INSUFFICIENT_HISTORY"

export type ForecastAssumption = {
  label: string
  value: string
}

export type Forecast = {
  methodKey: ForecastMethod
  method: string
  confidence: ForecastConfidence
  history: ForecastPoint[]
  future: ForecastPoint[]
  /** Complete series for charting: history followed by future periods. */
  series: ForecastPoint[]
  sampleMonths: number
  windowMonths: number
  averageMonthly: number
  baselineMonthly: number
  forecastMonthly: number | null
  dailyConsumption: number | null
  trendPercentPerMonth: number
  variabilityPercent: number
  seasonalIndices: SeasonalIndex[]
  horizonMonths: number
  assumptions: ForecastAssumption[]
  notes: string[]
  generatedAt: string
}

export const FORECAST_HORIZON_MONTHS = 3
export const FORECAST_WINDOW_MONTHS = 18
export const MIN_MONTHS_FOR_SEASONALITY = 8
export const MIN_MONTHS_FOR_HIGH_CONFIDENCE = 12
const MAX_TREND_PER_MONTH = 0.15
const SEASONALITY_DAMPING = 0.6
const WEIGHTS = [0.2, 0.3, 0.5]
const BAND_MULTIPLIER = 1.28

/**
 * Builds a monthly demand series ending with the current month, filling any
 * month without a recorded sample with a zero so gaps are never interpolated.
 */
function buildSeries(
  samples: DemandSampleInput[],
  windowMonths: number,
  now: Date,
): { series: DemandSampleInput[]; observedMonths: number } {
  const quantitiesByMonth = new Map<string, number>()
  for (const sample of samples) {
    const key = monthKey(sample.periodStart)
    quantitiesByMonth.set(key, (quantitiesByMonth.get(key) ?? 0) + sample.quantity)
  }

  const current = monthStart(now)
  const series: DemandSampleInput[] = []
  let observedMonths = 0

  for (let offset = windowMonths - 1; offset >= 0; offset -= 1) {
    const periodStart = addMonths(current, -offset)
    const quantity = quantitiesByMonth.get(monthKey(periodStart)) ?? 0
    if (quantity > 0) observedMonths += 1
    series.push({ periodStart, quantity })
  }

  return { series, observedMonths }
}

function weightedAverage(values: number[]) {
  const recent = values.slice(-WEIGHTS.length)
  let weighted = 0
  let totalWeight = 0
  recent.forEach((value, index) => {
    const weight = WEIGHTS[index + (WEIGHTS.length - recent.length)] ?? 0
    weighted += value * weight
    totalWeight += weight
  })
  return totalWeight > 0 ? weighted / totalWeight : 0
}

function leastSquaresSlope(values: number[]) {
  const count = values.length
  if (count < 3) return 0
  const xMean = (count - 1) / 2
  const yMean = values.reduce((sum, value) => sum + value, 0) / count
  let numerator = 0
  let denominator = 0
  values.forEach((value, index) => {
    numerator += (index - xMean) * (value - yMean)
    denominator += (index - xMean) ** 2
  })
  return denominator === 0 ? 0 : numerator / denominator
}

function standardDeviation(values: number[], mean: number) {
  if (values.length < 2) return 0
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    values.length
  return Math.sqrt(variance)
}

function buildSeasonalIndices(
  series: DemandSampleInput[],
  overallMean: number,
): SeasonalIndex[] {
  const byMonth = new Map<number, number[]>()
  for (const sample of series) {
    const bucket = byMonth.get(sample.periodStart.getMonth()) ?? []
    bucket.push(sample.quantity)
    byMonth.set(sample.periodStart.getMonth(), bucket)
  }

  return Array.from({ length: 12 }, (_, month) => {
    const values = byMonth.get(month) ?? []
    const rawIndex = overallMean > 0 && values.length > 0
      ? values.reduce((sum, value) => sum + value, 0) / values.length / overallMean
      : 1
    // Damp noisy single observations towards a flat index.
    const index = values.length >= 2
      ? SEASONALITY_DAMPING * rawIndex + (1 - SEASONALITY_DAMPING)
      : 1
    return {
      month,
      monthName: monthName(month),
      index: Number(index.toFixed(3)),
      observations: values.length,
    }
  })
}

function confidenceFor(sampleMonths: number, variability: number) {
  if (sampleMonths >= MIN_MONTHS_FOR_HIGH_CONFIDENCE && variability <= 0.35) {
    return "HIGH"
  }
  if (sampleMonths >= 4) return "MEDIUM"
  return "LOW"
}

/**
 * Monthly demand forecast built from a stockist's own delivered order history.
 *
 * The method is intentionally explainable: a weighted moving average sets the
 * baseline, a capped least-squares trend and damped calendar-month indices
 * shape it, and every input is returned as a human-readable assumption so the
 * UI can present this as decision support rather than a promise.
 */
export function buildForecast(
  samples: DemandSampleInput[],
  options: { now?: Date; horizonMonths?: number; windowMonths?: number } = {},
): Forecast {
  const now = options.now ?? new Date()
  const horizonMonths = options.horizonMonths ?? FORECAST_HORIZON_MONTHS
  const windowMonths = options.windowMonths ?? FORECAST_WINDOW_MONTHS
  const { series, observedMonths } = buildSeries(samples, windowMonths, now)
  const values = series.map((sample) => sample.quantity)
  const averageMonthly = values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0
  const seasonalIndices = buildSeasonalIndices(series, averageMonthly)
  const notes = [
    "Forecasts are decision support derived from your own order history. They are estimates, not demand guarantees.",
    "Demand is measured in ordered units from delivered and in-flight purchase orders; cancelled and rejected orders are excluded.",
  ]

  if (observedMonths === 0) {
    return {
      methodKey: "INSUFFICIENT_HISTORY",
      method: "No forecast — no recorded demand yet",
      confidence: "LOW",
      history: [],
      future: [],
      series: [],
      sampleMonths: 0,
      windowMonths,
      averageMonthly: 0,
      baselineMonthly: 0,
      forecastMonthly: null,
      dailyConsumption: null,
      trendPercentPerMonth: 0,
      variabilityPercent: 0,
      seasonalIndices: [],
      horizonMonths,
      assumptions: [
        { label: "History window", value: `Last ${windowMonths} months` },
        { label: "Recorded demand months", value: "0 of 18" },
        { label: "Method used", value: "None — a minimum of one month of history is required" },
      ],
      notes: [
        ...notes,
        "Deliver at least one purchase order for this product to unlock a demand forecast.",
      ],
      generatedAt: now.toISOString(),
    }
  }

  const variability = standardDeviation(values, averageMonthly)
  const variabilityPercent = averageMonthly > 0 ? variability / averageMonthly : 0
  const useSeasonality = observedMonths >= MIN_MONTHS_FOR_SEASONALITY
  const sparse = observedMonths < 3
  const baselineMonthly = sparse ? averageMonthly : weightedAverage(values)
  const rawSlope = sparse ? 0 : leastSquaresSlope(values)
  const trendPercentPerMonth = averageMonthly > 0
    ? Math.max(-MAX_TREND_PER_MONTH, Math.min(MAX_TREND_PER_MONTH, rawSlope / averageMonthly))
    : 0

  const history: ForecastPoint[] = series.map((sample) => ({
    periodKey: monthKey(sample.periodStart),
    label: monthLabel(sample.periodStart),
    actual: sample.quantity,
    forecast: null,
    lowerBound: null,
    upperBound: null,
  }))

  const future: ForecastPoint[] = []
  const current = monthStart(now)
  for (let step = 1; step <= horizonMonths; step += 1) {
    const periodStart = addMonths(current, step)
    const seasonal = useSeasonality
      ? seasonalIndices[periodStart.getMonth()]?.index ?? 1
      : 1
    const value = Math.max(
      0,
      baselineMonthly * (1 + trendPercentPerMonth * step) * seasonal,
    )
    const spread = BAND_MULTIPLIER * variability * Math.sqrt(step)
    future.push({
      periodKey: monthKey(periodStart),
      label: monthLabel(periodStart),
      actual: null,
      forecast: Math.round(value),
      lowerBound: Math.max(0, Math.round(value - spread)),
      upperBound: Math.round(value + spread),
    })
  }

  const methodKey: ForecastMethod = sparse
    ? "SIMPLE_AVERAGE"
    : "WEIGHTED_MOVING_AVERAGE"
  const method = sparse
    ? "Simple average of recorded months (sparse history fallback)"
    : `Weighted ${WEIGHTS.length}-month moving average with ${useSeasonality ? "damped calendar-month seasonality" : "flat seasonality"}`

  const assumptions: ForecastAssumption[] = [
    {
      label: "History window",
      value: `Last ${windowMonths} months (${observedMonths} with recorded demand)`,
    },
    {
      label: "Baseline method",
      value: sparse
        ? "Simple average — too few months for a moving average"
        : `Weighted ${WEIGHTS.length}-month moving average (${WEIGHTS.map((weight) => `${Math.round(weight * 100)}%`).join(" / ")})`,
    },
    {
      label: "Trend",
      value: sparse
        ? "Not applied — at least 3 months of history required"
        : `${trendPercentPerMonth >= 0 ? "+" : ""}${(trendPercentPerMonth * 100).toFixed(1)}% per month, capped at ±${MAX_TREND_PER_MONTH * 100}%`,
    },
    {
      label: "Seasonality",
      value: useSeasonality
        ? `Calendar-month indices from ${observedMonths} observations, damped ${Math.round(SEASONALITY_DAMPING * 100)}% towards flat`
        : `Not applied — needs ${MIN_MONTHS_FOR_SEASONALITY}+ months of history`,
    },
    {
      label: "Forecast horizon",
      value: `${horizonMonths} months ahead`,
    },
    {
      label: "Prediction band",
      value: variabilityPercent > 0
        ? `±${Math.round(BAND_MULTIPLIER * variabilityPercent * 100)}% (80% band from historical variability of ${(variabilityPercent * 100).toFixed(0)}%)`
        : "No variability band — every recorded month was identical",
    },
    {
      label: "Rounding",
      value: "Whole units, weekly consumption derived as monthly ÷ 30.4",
    },
  ]

  const forecastMonthly = future.length
    ? future.reduce((sum, point) => sum + (point.forecast ?? 0), 0) / future.length
    : null

  return {
    methodKey,
    method,
    confidence: confidenceFor(observedMonths, variabilityPercent),
    history,
    future,
    series: [...history, ...future],
    sampleMonths: observedMonths,
    windowMonths,
    averageMonthly: Math.round(averageMonthly),
    baselineMonthly: Math.round(baselineMonthly),
    forecastMonthly: forecastMonthly === null ? null : Math.round(forecastMonthly),
    dailyConsumption: forecastMonthly === null ? null : forecastMonthly / 30.4,
    trendPercentPerMonth: Number(trendPercentPerMonth.toFixed(4)),
    variabilityPercent: Number(variabilityPercent.toFixed(4)),
    seasonalIndices,
    horizonMonths,
    assumptions,
    notes: [
      ...notes,
      sparse
        ? "Only a few months of history exist, so this estimate is a starting point rather than a reliable signal."
        : "Re-run the forecast after each delivery: the baseline updates as new demand is recorded.",
    ],
    generatedAt: now.toISOString(),
  }
}
