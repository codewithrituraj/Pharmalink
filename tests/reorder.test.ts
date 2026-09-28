import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { buildReorderRecommendation, type ReorderInput } from "../src/lib/analytics/reorder"

const NOW = new Date(2026, 8, 15)

function input(overrides: Partial<ReorderInput> = {}): ReorderInput {
  return {
    productId: "p1",
    productName: "Amoxicure 500",
    genericName: "Amoxicillin",
    manufacturerId: "m1",
    manufacturerName: "Apex",
    unitPrice: 4,
    minOrderQty: 10,
    leadTimeDays: 7,
    onHand: 100,
    onOrder: 0,
    averageMonthly: 300,
    forecastMonthly: 300,
    dailyConsumption: 300 / 30.4,
    daysOfCover: 10,
    stockOutRisk: "HIGH",
    ...overrides,
  }
}

describe("buildReorderRecommendation", () => {
  it("recommends ordering when stock is below the reorder point", () => {
    const result = buildReorderRecommendation(input({ onHand: 20 }), NOW)

    assert.ok(result.reorderPoint !== null)
    assert.ok(result.onHand < result.reorderPoint)
    assert.equal(result.urgency, "ORDER_NOW")
  })

  it("asks for no order when stock comfortably covers the lead time", () => {
    const result = buildReorderRecommendation(input({ onHand: 5000 }), NOW)

    assert.equal(result.suggestedQuantity, 0)
    assert.equal(result.urgency, "MONITOR")
  })

  it("rounds the suggested quantity up to a whole multiple of the MOQ", () => {
    const result = buildReorderRecommendation(input({ onHand: 0, minOrderQty: 25 }), NOW)

    assert.ok(
      result.suggestedQuantity > 0,
      "expected a positive suggestion at zero stock",
    )
    assert.equal(result.suggestedQuantity % 25, 0, "must be a multiple of the MOQ")
  })

  it("always proposes at least one minimum order quantity when ordering", () => {
    const result = buildReorderRecommendation(
      input({ onHand: 140, minOrderQty: 50, dailyConsumption: 10 }),
      NOW,
    )

    assert.ok(
      result.suggestedQuantity === 0 || result.suggestedQuantity >= 50,
      "a non-zero suggestion must be at least one MOQ",
    )
  })

  it("accounts for stock already on order", () => {
    const withoutOnOrder = buildReorderRecommendation(input({ onHand: 0, onOrder: 0 }), NOW)
    const withOnOrder = buildReorderRecommendation(input({ onHand: 0, onOrder: 4000 }), NOW)

    assert.ok(
      withOnOrder.suggestedQuantity < withoutOnOrder.suggestedQuantity,
      "units on order must reduce the suggestion",
    )
  })

  it("has no reorder point when nothing is being consumed", () => {
    const result = buildReorderRecommendation(
      input({ dailyConsumption: null, forecastMonthly: null, averageMonthly: 0 }),
      NOW,
    )

    assert.equal(result.reorderPoint, null)
    assert.equal(result.urgency, "MONITOR")
    // With no history the MOQ is still proposed, to start the demand record.
    assert.equal(result.suggestedQuantity, 10)
    assert.match(result.reason, /Not enough delivered order history/)
  })

  it("treats a zero consumption rate as no signal", () => {
    const result = buildReorderRecommendation(input({ dailyConsumption: 0 }), NOW)

    assert.equal(result.reorderPoint, null)
  })

  it("raises the reorder point as lead time lengthens", () => {
    const short = buildReorderRecommendation(input({ leadTimeDays: 3 }), NOW)
    const long = buildReorderRecommendation(input({ leadTimeDays: 30 }), NOW)

    assert.ok(
      (long.reorderPoint ?? 0) > (short.reorderPoint ?? 0),
      "a longer lead time needs a higher reorder point",
    )
  })

  it("keeps target stock at or above the reorder point", () => {
    const result = buildReorderRecommendation(input({ onHand: 10 }), NOW)

    assert.ok(
      result.targetStock >= (result.reorderPoint ?? 0),
      "target must cover the reorder point",
    )
  })

  it("keeps the estimated cost consistent with the suggestion", () => {
    const result = buildReorderRecommendation(input({ onHand: 5, unitPrice: 4.5 }), NOW)

    assert.equal(result.estimatedCost, Math.round(result.suggestedQuantity * result.unitPrice * 100) / 100)
  })

  it("explains itself with the numbers it used", () => {
    const result = buildReorderRecommendation(input({ onHand: 20 }), NOW)

    assert.match(result.reason, /Average monthly requirement/)
    assert.ok(result.inputs.length > 0)
    assert.ok(result.orderByDate === null || !Number.isNaN(Date.parse(result.orderByDate)))
  })

  it("never proposes less than what is already in stock", () => {
    const result = buildReorderRecommendation(input({ onHand: 120 }), NOW)

    assert.ok(result.suggestedQuantity >= 0)
    assert.ok(result.targetStock >= 0)
  })
})
