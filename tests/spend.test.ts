import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { buildSpendReport, type SpendOrderInput } from "../src/lib/analytics/spend"

const NOW = new Date(2026, 8, 15)

function monthsAgo(count: number) {
  return new Date(2026, 8 - count, 10)
}

function order(overrides: Partial<SpendOrderInput> = {}): SpendOrderInput {
  return {
    id: "o1",
    createdAt: monthsAgo(1),
    total: 1000,
    status: "DELIVERED",
    sellerName: "Apex",
    items: [{ quantity: 10, price: 100, category: "Antibiotics" }],
    ...overrides,
  }
}

describe("buildSpendReport", () => {
  it("returns an empty report with no orders", () => {
    const report = buildSpendReport([], { now: NOW })

    assert.equal(report.total, 0)
    assert.equal(report.orderCount, 0)
    assert.equal(report.averageOrderValue, 0)
    assert.equal(report.changePercent, null)
  })

  it("sums counted orders in the window", () => {
    const report = buildSpendReport(
      [order({ total: 1000 }), order({ id: "o2", total: 500 })],
      { now: NOW },
    )

    assert.equal(report.total, 1500)
    assert.equal(report.orderCount, 2)
  })

  it("ignores cancelled, rejected and returned orders", () => {
    const report = buildSpendReport(
      [
        order({ id: "a", total: 1000 }),
        order({ id: "b", total: 9999, status: "CANCELLED" }),
        order({ id: "c", total: 8888, status: "REJECTED" }),
        order({ id: "d", total: 7777, status: "RETURNED" }),
      ],
      { now: NOW },
    )

    assert.equal(report.total, 1000)
    assert.equal(report.orderCount, 1)
  })

  it("leaves out orders from before the window", () => {
    const report = buildSpendReport(
      [order({ total: 1000 }), order({ id: "old", total: 5000, createdAt: monthsAgo(20) })],
      { now: NOW, months: 12 },
    )

    assert.equal(report.total, 1000)
  })

  it("compares against the preceding window of the same length", () => {
    const report = buildSpendReport(
      [
        order({ id: "now", total: 2000, createdAt: monthsAgo(1) }),
        order({ id: "before", total: 1000, createdAt: monthsAgo(13) }),
      ],
      { now: NOW, months: 12 },
    )

    assert.equal(report.previousTotal, 1000)
    assert.equal(report.changePercent, 100)
  })

  it("reports no change when there is nothing to compare against", () => {
    const report = buildSpendReport([order({ total: 500 })], { now: NOW })

    assert.equal(report.changePercent, null)
  })

  it("averages the order value over counted orders", () => {
    const report = buildSpendReport(
      [order({ id: "a", total: 1000 }), order({ id: "b", total: 2000 })],
      { now: NOW },
    )

    assert.equal(report.averageOrderValue, 1500)
  })

  it("breaks spend down by manufacturer, largest first", () => {
    const report = buildSpendReport(
      [
        order({ id: "a", total: 3000, sellerName: "Apex" }),
        order({ id: "b", total: 1000, sellerName: "Zenith" }),
      ],
      { now: NOW },
    )

    assert.deepEqual(
      report.byManufacturer.map((bucket) => bucket.label),
      ["Apex", "Zenith"],
    )
    assert.equal(report.topManufacturer?.label, "Apex")
  })

  it("breaks spend down by category from the line items", () => {
    const report = buildSpendReport(
      [
        order({
          id: "a",
          total: 3000,
          items: [
            { quantity: 5, price: 400, category: "Antibiotics" },
            { quantity: 1, price: 1000, category: "Analgesics" },
          ],
        }),
      ],
      { now: NOW },
    )

    assert.deepEqual(
      report.byCategory.map((bucket) => bucket.label),
      ["Antibiotics", "Analgesics"],
    )
  })

  it("gives shares that add up to the whole", () => {
    const report = buildSpendReport(
      [
        order({ id: "a", total: 3000, sellerName: "Apex" }),
        order({ id: "b", total: 1000, sellerName: "Zenith" }),
      ],
      { now: NOW },
    )

    const totalShare = report.byManufacturer.reduce((sum, bucket) => sum + bucket.share, 0)
    assert.ok(Math.abs(totalShare - 1) < 1e-9, `shares summed to ${totalShare}`)
  })

  it("builds one bucket per month across the window", () => {
    const report = buildSpendReport(
      [
        order({ id: "a", createdAt: monthsAgo(1) }),
        order({ id: "b", createdAt: monthsAgo(3) }),
      ],
      { now: NOW, months: 12 },
    )

    assert.equal(report.byMonth.length, 12)
    assert.equal(
      report.byMonth.reduce((sum, bucket) => sum + bucket.value, 0),
      report.total,
    )
  })

  it("keeps monthly buckets in chronological order", () => {
    const report = buildSpendReport([order()], { now: NOW, months: 12 })
    const keys = report.byMonth.map((bucket) => bucket.periodKey)

    assert.deepEqual(keys, [...keys].sort())
  })

  it("shares nothing when there is no spend", () => {
    const report = buildSpendReport([order({ total: 0 })], { now: NOW })

    for (const bucket of report.byManufacturer) assert.equal(bucket.share, 0)
  })

  it("states its assumptions", () => {
    const report = buildSpendReport([order()], { now: NOW })

    assert.ok(report.assumptions.length > 0)
    assert.ok(report.notes.length > 0)
    assert.equal(typeof report.rangeLabel, "string")
  })
})
