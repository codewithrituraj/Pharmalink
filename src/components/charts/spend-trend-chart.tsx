"use client"

import { BarChart, type BarChartPoint } from "@/components/charts/bar-chart"
import { formatCompactCurrency } from "@/lib/format"

type SpendTrendChartProps = {
  data: { key: string; label: string; value: number; detail?: string }[]
  ariaLabel: string
}

/**
 * Spend trend chart as a client component so the currency formatter lives on
 * the client: a server component cannot pass a function into a client component.
 */
export function SpendTrendChart({ data, ariaLabel }: SpendTrendChartProps) {
  const points: BarChartPoint[] = data.map((point) => ({
    key: point.key,
    label: point.label,
    value: point.value,
    detail: point.detail,
  }))

  return (
    <BarChart
      data={points}
      height={200}
      ariaLabel={ariaLabel}
      primaryLabel="Spend"
      valueFormatter={formatCompactCurrency}
    />
  )
}
