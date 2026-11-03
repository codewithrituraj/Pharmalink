import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  FORECAST_HORIZON_MONTHS,
  buildForecast,
  type DemandSampleInput,
} from "../src/lib/analytics/forecast"
import { monthStart, addMonths } from "../src/lib/analytics/dates"

const NOW = new Date(2026, 8, 15) // 15 Sep 2026, part-way through the month

function monthsAgo(count: number) {
  return monthStart(addMonths(NOW, -count))
}

function sample(count: number, quantity: number): DemandSampleInput {
  return { periodStart: monthsAgo(count), quantity }
}

describe("buildForecast", () => {
  it("returns no forecast when nothing has been ordered", () => {
    const forecast = buildForecast([], { now: NOW })

    assert.equal(forecast.methodKey, "INSUFFICIENT_HISTORY")
    assert.equal(forecast.forecastMonthly, null)
    assert.equal(forecast.dailyConsumption, null)
    assert.equal(forecast.sampleMonths, 0)
  })

  it("still forecasts from a single order", () => {
    const forecast = buildForecast([sample(2, 100)], { now: NOW })

    assert.equal(forecast.methodKey, "SIMPLE_AVERAGE")
    assert.equal(forecast.forecastMonthly, 100)
    assert.equal(forecast.sampleMonths, 1)
  })

  it("treats months without an order as missing rather than as zero demand", () => {
    // Orders every third month. The gaps must not dilute the average.
    const forecast = buildForecast(
      [sample(3, 150), sample(6, 150), sample(9, 150), sample(12, 150)],
      { now: NOW },
    )

    assert.equal(forecast.averageMonthly, 150)
    assert.equal(forecast.forecastMonthly, 150)
    assert.equal(forecast.sampleMonths, 4)
  })

  it("does not let trailing gaps drag the forecast down", () => {
    // A trailing gap is the real-world shape: the product was reordered
    // regularly, then not at all in the most recent months.
    const forecast = buildForecast(
      [sample(2, 200), sample(4, 200), sample(6, 200), sample(8, 200)],
      { now: NOW },
    )

    assert.ok(
      forecast.forecastMonthly !== null && forecast.forecastMonthly >= 190,
      `expected roughly 200, received ${forecast.forecastMonthly}`,
    )
  })

  it("excludes months before the first recorded order", () => {
    const withPreListingGaps = buildForecast(
      [sample(1, 120), sample(2, 120), sample(3, 120), sample(4, 120)],
      { now: NOW },
    )
    const withoutHistory = buildForecast(
      [sample(1, 120), sample(2, 120), sample(3, 120), sample(4, 120)],
      { now: NOW, windowMonths: 6 },
    )

    assert.equal(withPreListingGaps.averageMonthly, 120)
    assert.equal(withoutHistory.averageMonthly, 120)
  })

  it("ignores a part-finished current month instead of reading it as no demand", () => {
    const completed = buildForecast(
      [sample(1, 180), sample(2, 180), sample(3, 180), sample(4, 180)],
      { now: NOW },
    )
    const withPartialOrder = buildForecast(
      [
        { periodStart: monthStart(NOW), quantity: 20 },
        sample(1, 180),
        sample(2, 180),
        sample(3, 180),
        sample(4, 180),
      ],
      { now: NOW },
    )

    assert.equal(completed.averageMonthly, 180)
    assert.equal(withPartialOrder.averageMonthly, 180)
    assert.equal(withPartialOrder.sampleMonths, 5)
  })

  it("falls back to the current month when it holds the only record", () => {
    const forecast = buildForecast(
      [{ periodStart: monthStart(NOW), quantity: 90 }],
      { now: NOW },
    )

    assert.equal(forecast.forecastMonthly, 90)
    assert.equal(forecast.sampleMonths, 1)
  })

  it("marks unrecorded months as gaps in the series", () => {
    const forecast = buildForecast(
      [sample(2, 150), sample(6, 150)],
      { now: NOW },
    )

    const recorded = forecast.series.filter((point) => point.actual !== null)
    const gaps = forecast.series.filter(
      (point) => point.actual === null && point.forecast === null,
    )

    assert.equal(recorded.length, 2)
    assert.equal(gaps.length, 18 - 2)
    assert.equal(forecast.future.length, FORECAST_HORIZON_MONTHS)
  })

  it("detects a rising trend", () => {
    // Oldest month first: demand climbing from 100 to 200.
    const forecast = buildForecast(
      [
        sample(6, 100),
        sample(5, 120),
        sample(4, 140),
        sample(3, 160),
        sample(2, 180),
        sample(1, 200),
      ],
      { now: NOW },
    )

    assert.ok(forecast.trendPercentPerMonth > 0, "expected a positive trend")
  })

  it("detects a falling trend", () => {
    const forecast = buildForecast(
      [
        sample(6, 200),
        sample(5, 180),
        sample(4, 160),
        sample(3, 140),
        sample(2, 120),
        sample(1, 100),
      ],
      { now: NOW },
    )

    assert.ok(forecast.trendPercentPerMonth < 0, "expected a negative trend")
  })

  it("calls a flat series flat", () => {
    const forecast = buildForecast(
      [
        sample(6, 100),
        sample(5, 100),
        sample(4, 100),
        sample(3, 100),
        sample(2, 100),
        sample(1, 100),
      ],
      { now: NOW },
    )

    assert.equal(forecast.trendPercentPerMonth, 0)
    assert.equal(forecast.forecastMonthly, 100)
  })

  it("never forecasts a negative quantity", () => {
    const forecast = buildForecast(
      [
        sample(1, 300),
        sample(2, 250),
        sample(3, 200),
        sample(4, 150),
        sample(5, 100),
        sample(6, 60),
        sample(7, 30),
        sample(8, 10),
        sample(9, 5),
        sample(10, 2),
        sample(11, 1),
        sample(12, 1),
      ],
      { now: NOW },
    )

    for (const point of forecast.future) {
      assert.ok((point.forecast ?? 0) >= 0, "forecast must not go negative")
      assert.ok((point.lowerBound ?? 0) >= 0, "lower band must not go negative")
      assert.ok((point.forecast ?? 0) <= (point.upperBound ?? 0), "band must bracket the estimate")
      assert.ok((point.lowerBound ?? 0) <= (point.forecast ?? 0), "band must bracket the estimate")
    }
  })

  it("keeps the prediction band ordered and widening with distance", () => {
    const forecast = buildForecast(
      [
        sample(1, 100),
        sample(2, 140),
        sample(3, 90),
        sample(4, 160),
        sample(5, 110),
        sample(6, 150),
      ],
      { now: NOW },
    )

    const widths = forecast.future.map(
      (point) => (point.upperBound ?? 0) - (point.lowerBound ?? 0),
    )
    for (const width of widths) assert.ok(width > 0)
    assert.ok(widths[1] >= widths[0], "band should not shrink further out")
  })

  it("reports how missing months were handled", () => {
    const forecast = buildForecast(
      [sample(2, 150), sample(6, 150)],
      { now: NOW },
    )
    const assumptions = forecast.assumptions.map((item) => item.value).join(" ")

    assert.match(assumptions, /not as zero demand/)
  })

  it("caps the trend it extrapolates", () => {
    const forecast = buildForecast(
      [
        sample(1, 10),
        sample(2, 20),
        sample(3, 40),
        sample(4, 80),
        sample(5, 160),
        sample(6, 320),
        sample(7, 640),
      ],
      { now: NOW },
    )

    assert.ok(
      forecast.trendPercentPerMonth <= 0.15,
      `trend should cap at 15%/month, received ${forecast.trendPercentPerMonth}`,
    )
  })
})
