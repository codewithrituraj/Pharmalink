"use client"

import { useState } from "react"
import { useElementWidth } from "@/hooks/use-element-width"

export type BarChartPoint = {
  key: string
  label: string
  /** Recorded value. Use `null` for future periods. */
  value: number | null
  /** Modelled value, used for forecast periods. */
  forecast?: number | null
  band?: { lower: number; upper: number } | null
  /** Extra line shown in the tooltip, e.g. order count. */
  detail?: string
}

export type BarChartProps = {
  data: BarChartPoint[]
  height?: number
  valueFormatter?: (value: number) => string
  primaryLabel?: string
  forecastLabel?: string
  className?: string
  ariaLabel: string
}

const AXIS_WIDTH = 46
const TOP_PADDING = 12
const BOTTOM_PADDING = 26
const GAP_RATIO = 0.35
const MIN_BAR_WIDTH = 5

function niceCeiling(value: number) {
  if (value <= 0) return 10
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalised = value / magnitude
  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10
  return step * magnitude
}

/**
 * Vertical bar chart with an optional forecast overlay and prediction band.
 * Rendered as real SVG at the measured pixel width so labels stay readable on
 * small screens, and themed entirely through Tailwind colour tokens so it
 * follows the light and dark palettes.
 */
export function BarChart({
  data,
  height = 220,
  valueFormatter = (value) => value.toLocaleString("en-IN"),
  primaryLabel = "Actual",
  forecastLabel = "Forecast",
  className,
  ariaLabel,
}: BarChartProps) {
  const { ref, width } = useElementWidth<HTMLDivElement>()
  const [hovered, setHovered] = useState<number | null>(null)

  const chartWidth = Math.max(width, 280)
  const values = data.flatMap((point) => [
    point.value ?? 0,
    point.forecast ?? 0,
    point.band?.upper ?? 0,
  ])
  const maxValue = niceCeiling(Math.max(...values, 1))
  const plotWidth = Math.max(chartWidth - AXIS_WIDTH - 8, 40)
  const plotHeight = Math.max(height - TOP_PADDING - BOTTOM_PADDING, 40)
  const slotWidth = plotWidth / Math.max(data.length, 1)
  const barWidth = Math.max(Math.min(slotWidth * (1 - GAP_RATIO), 46), MIN_BAR_WIDTH)
  const baseline = TOP_PADDING + plotHeight

  const scale = (value: number) => baseline - (value / maxValue) * plotHeight
  const ticks = [0, 0.5, 1].map((fraction) => ({
    value: maxValue * fraction,
    y: TOP_PADDING + plotHeight * (1 - fraction),
  }))

  // Connect the last recorded bar to the forecast with a dashed line.
  const trendPoints: string[] = []
  data.forEach((point, index) => {
    const value = point.forecast ?? point.value
    if (value === null || value === undefined) return
    const x = AXIS_WIDTH + slotWidth * index + slotWidth / 2
    trendPoints.push(`${x},${scale(value)}`)
  })

  const activePoint = hovered === null ? null : data[hovered]

  return (
    <div ref={ref} className={`relative w-full ${className ?? ""}`}>
      {width > 0 && (
        <svg
          width={chartWidth}
          height={height}
          viewBox={`0 0 ${chartWidth} ${height}`}
          role="img"
          aria-label={ariaLabel}
          className="touch-manipulation overflow-visible"
          onMouseLeave={() => setHovered(null)}
        >
          {ticks.map((tick) => (
            <g key={tick.value}>
              <line
                x1={AXIS_WIDTH}
                x2={chartWidth - 8}
                y1={tick.y}
                y2={tick.y}
                className="stroke-border"
                strokeWidth={1}
                strokeDasharray={tick.value === 0 ? undefined : "3 4"}
              />
              <text
                x={AXIS_WIDTH - 8}
                y={tick.y + 4}
                textAnchor="end"
                className="fill-muted-foreground text-[0.62rem]"
              >
                {valueFormatter(tick.value)}
              </text>
            </g>
          ))}

          {data.map((point, index) => {
            const x = AXIS_WIDTH + slotWidth * index + slotWidth / 2
            const isHovered = hovered === index
            return (
              <g key={point.key}>
                {point.band ? (
                  <rect
                    x={x - slotWidth / 2 + 1}
                    y={scale(point.band.upper)}
                    width={slotWidth - 2}
                    height={Math.max(0, scale(point.band.lower) - scale(point.band.upper))}
                    className="fill-primary/10"
                    rx={3}
                  />
                ) : null}

                {point.value !== null ? (
                  <rect
                    x={x - barWidth / 2}
                    y={scale(point.value)}
                    width={barWidth}
                    height={Math.max(0, baseline - scale(point.value))}
                    rx={Math.min(4, barWidth / 2)}
                    className={isHovered ? "fill-primary" : "fill-primary/85"}
                  />
                ) : null}

                {point.forecast !== null && point.forecast !== undefined ? (
                  <rect
                    x={x - barWidth / 2}
                    y={scale(point.forecast)}
                    width={barWidth}
                    height={Math.max(0, baseline - scale(point.forecast))}
                    rx={Math.min(4, barWidth / 2)}
                    className={isHovered ? "fill-primary/30 stroke-primary" : "fill-primary/20 stroke-primary/70"}
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                  />
                ) : null}

                <rect
                  x={x - slotWidth / 2}
                  y={TOP_PADDING}
                  width={slotWidth}
                  height={plotHeight}
                  fill="transparent"
                  onMouseEnter={() => setHovered(index)}
                  onFocus={() => setHovered(index)}
                  onBlur={() => setHovered(null)}
                  tabIndex={0}
                  role="button"
                  aria-label={`${point.label}: ${point.value !== null ? valueFormatter(point.value) : `forecast ${valueFormatter(point.forecast ?? 0)}`}`}
                >
                  <title>
                    {point.label}:{" "}
                    {point.value !== null
                      ? valueFormatter(point.value)
                      : `forecast ${valueFormatter(point.forecast ?? 0)}`}
                  </title>
                </rect>

                <text
                  x={x}
                  y={height - 8}
                  textAnchor="middle"
                  className={isHovered ? "fill-foreground text-[0.62rem]" : "fill-muted-foreground text-[0.62rem]"}
                >
                  {point.label}
                </text>
              </g>
            )
          })}

          {trendPoints.length > 1 && (
            <polyline
              points={trendPoints.join(" ")}
              fill="none"
              className="stroke-primary"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              strokeLinecap="round"
              opacity={0.6}
            />
          )}
        </svg>
      )}

      {activePoint ? (
        <div
          className="pointer-events-none absolute z-10 w-max max-w-56 rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg"
          style={{
            left: Math.min(
              Math.max(AXIS_WIDTH + slotWidth * (hovered ?? 0) + slotWidth / 2 - 60, 0),
              Math.max(chartWidth - 150, 0),
            ),
            top: 0,
          }}
        >
          <p className="font-semibold">{activePoint.label}</p>
          {activePoint.value !== null ? (
            <p className="mt-1">
              {primaryLabel}: <span className="number">{valueFormatter(activePoint.value)}</span>
            </p>
          ) : null}
          {activePoint.forecast !== null && activePoint.forecast !== undefined ? (
            <p className="mt-0.5">
              {forecastLabel}: <span className="number">{valueFormatter(activePoint.forecast)}</span>
            </p>
          ) : null}
          {activePoint.band ? (
            <p className="mt-0.5 text-muted-foreground">
              80% band: <span className="number">{valueFormatter(activePoint.band.lower)}</span>–
              <span className="number">{valueFormatter(activePoint.band.upper)}</span>
            </p>
          ) : null}
          {activePoint.detail ? (
            <p className="mt-0.5 text-muted-foreground">{activePoint.detail}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
