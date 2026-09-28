import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  EXPIRY_HORIZON_DAYS,
  buildExpiryReport,
  stockOutDate,
  type ExpiryBatchRecord,
} from "../src/lib/analytics/expiry"

const NOW = new Date(2026, 8, 15)

function daysFromNow(days: number) {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000)
}

function batch(overrides: Partial<ExpiryBatchRecord> = {}): ExpiryBatchRecord {
  return {
    id: "b1",
    productId: "p1",
    productName: "Amoxicure 500",
    genericName: "Amoxicillin",
    manufacturerName: "Apex",
    batchNumber: "AX-1",
    quantity: 100,
    expiryDate: daysFromNow(30),
    receivedAt: daysFromNow(-60),
    sourceOrderId: null,
    unitPrice: 4,
    minOrderQty: 10,
    leadTimeDays: 7,
    ...overrides,
  }
}

describe("buildExpiryReport", () => {
  it("returns an empty report when there is no stock", () => {
    const report = buildExpiryReport([], { now: NOW })

    assert.equal(report.totals.batches, 0)
    assert.equal(report.totals.units, 0)
    assert.equal(report.batches.length, 0)
  })

  it("separates expired stock from stock still in date", () => {
    const report = buildExpiryReport(
      [batch({ id: "a", expiryDate: daysFromNow(-5) }), batch({ id: "b", expiryDate: daysFromNow(10) })],
      { now: NOW },
    )

    assert.equal(report.totals.expired, 1)
    assert.equal(report.totals.within30, 1)
  })

  it("puts each batch in exactly one band", () => {
    const report = buildExpiryReport(
      [
        batch({ id: "a", expiryDate: daysFromNow(-5) }),
        batch({ id: "b", expiryDate: daysFromNow(20) }),
        batch({ id: "c", expiryDate: daysFromNow(45) }),
        batch({ id: "d", expiryDate: daysFromNow(75) }),
        batch({ id: "e", expiryDate: daysFromNow(200) }),
      ],
      { now: NOW },
    )

    const { EXPIRED, WITHIN_30, WITHIN_60, WITHIN_90, LATER } = report.counts
    assert.equal(EXPIRED, 1)
    assert.equal(WITHIN_30, 1)
    assert.equal(WITHIN_60, 1)
    assert.equal(WITHIN_90, 1)
    assert.equal(LATER, 1)
    assert.equal(
      EXPIRED + WITHIN_30 + WITHIN_60 + WITHIN_90 + LATER,
      5,
      "every batch must land in exactly one band",
    )
    assert.equal(report.totals.batches, 5)
  })

  it("keeps cumulative counts within 30, 60 and 90 days nested", () => {
    const report = buildExpiryReport(
      [
        batch({ id: "a", expiryDate: daysFromNow(20) }),
        batch({ id: "b", expiryDate: daysFromNow(50) }),
        batch({ id: "c", expiryDate: daysFromNow(80) }),
      ],
      { now: NOW },
    )

    assert.ok(report.totals.within30 <= report.totals.within60)
    assert.ok(report.totals.within60 <= report.totals.within90)
  })

  it("leaves stock beyond the horizon out of the at-risk totals", () => {
    const report = buildExpiryReport(
      [batch({ quantity: 500, expiryDate: daysFromNow(EXPIRY_HORIZON_DAYS + 60) })],
      { now: NOW },
    )

    assert.equal(report.totals.unitsAtRisk, 0)
    assert.equal(report.totals.valueAtRisk, 0)
    assert.equal(report.totals.batches, 1)
  })

  it("sorts the soonest expiry first", () => {
    const report = buildExpiryReport(
      [
        batch({ id: "late", expiryDate: daysFromNow(80) }),
        batch({ id: "soon", expiryDate: daysFromNow(5) }),
        batch({ id: "mid", expiryDate: daysFromNow(40) }),
      ],
      { now: NOW },
    )

    const dates = report.batches.map((row) => new Date(row.expiryDate).getTime())
    const sorted = [...dates].sort((a, b) => a - b)
    assert.deepEqual(dates, sorted)
  })

  it("ignores batches with no units left", () => {
    const report = buildExpiryReport([batch({ quantity: 0, expiryDate: daysFromNow(5) })], {
      now: NOW,
    })

    assert.equal(report.totals.units, 0)
    assert.equal(report.batches.length, 0)
  })

  it("values at-risk stock from the unit price", () => {
    const report = buildExpiryReport(
      [batch({ quantity: 100, unitPrice: 2.5, expiryDate: daysFromNow(10) })],
      { now: NOW },
    )

    assert.equal(report.totals.valueAtRisk, 250)
  })

  it("ranks batches for the same product in FEFO order", () => {
    const report = buildExpiryReport(
      [
        batch({ id: "second", productId: "p1", expiryDate: daysFromNow(60) }),
        batch({ id: "first", productId: "p1", expiryDate: daysFromNow(20) }),
      ],
      { now: NOW },
    )

    const rows = report.batches.filter((row) => row.productId === "p1")
    assert.equal(rows[0].id, "first", "the soonest expiry is consumed first")
    assert.equal(rows[0].fefoRank, 1)
    assert.equal(rows[1].fefoRank, 2)
  })

  it("states its assumptions", () => {
    const report = buildExpiryReport([batch()], { now: NOW })

    assert.ok(report.assumptions.length > 0)
    assert.ok(report.notes.length > 0)
  })
})

describe("stockOutDate", () => {
  it("returns a date the given number of days ahead", () => {
    const date = stockOutDate(10, NOW)

    assert.ok(date instanceof Date)
    assert.equal(Math.round((date!.getTime() - NOW.getTime()) / 86_400_000), 10)
  })

  it("never returns a date in the past", () => {
    const date = stockOutDate(-5, NOW)

    assert.ok(date === null || date.getTime() >= NOW.getTime())
  })

  it("has no date for an unusable cover figure", () => {
    assert.equal(stockOutDate(Number.NaN, NOW), null)
    assert.equal(stockOutDate(Number.POSITIVE_INFINITY, NOW), null)
  })
})
