import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  ORDER_TRANSITIONS,
  allocateFefo,
  bestScheme,
  canCancel,
  canTransition,
  priceLines,
  totalAllocated,
  type FefoBatch,
} from "../src/lib/orders"

const DAY = 86_400_000
const BASE = new Date(2026, 0, 1)

function inDays(days: number) {
  return new Date(BASE.getTime() + days * DAY)
}

function batch(id: string, quantity: number, expiryInDays: number): FefoBatch {
  return { id, quantity, expiryDate: inDays(expiryInDays) }
}

describe("allocateFefo", () => {
  it("takes everything from the batch that expires soonest", () => {
    const result = allocateFefo([batch("late", 500, 200), batch("soon", 500, 10)], 100)

    assert.deepEqual(result.allocations, [{ batchId: "soon", quantity: 100 }])
    assert.equal(result.shortfall, 0)
  })

  it("spills into the next batch when the first runs out", () => {
    const result = allocateFefo(
      [batch("b-late", 500, 200), batch("a-soon", 30, 10), batch("b-mid", 500, 90)],
      100,
    )

    assert.deepEqual(result.allocations, [
      { batchId: "a-soon", quantity: 30 },
      { batchId: "b-mid", quantity: 70 },
    ])
    assert.equal(result.shortfall, 0)
  })

  it("spills across three batches in expiry order", () => {
    const result = allocateFefo(
      [batch("c", 50, 300), batch("a", 50, 10), batch("b", 50, 100)],
      120,
    )

    assert.deepEqual(
      result.allocations.map((allocation) => allocation.batchId),
      ["a", "b", "c"],
    )
    assert.equal(totalAllocated(result.allocations), 120)
  })

  it("never reserves more than it was asked for", () => {
    const result = allocateFefo([batch("a", 1000, 10)], 40)

    assert.equal(totalAllocated(result.allocations), 40)
  })

  it("reports a shortfall when stock cannot cover the order", () => {
    const result = allocateFefo([batch("a", 30, 10), batch("b", 20, 50)], 100)

    assert.equal(result.shortfall, 50)
    assert.equal(totalAllocated(result.allocations), 50)
  })

  it("reports a full shortfall with no stock at all", () => {
    const result = allocateFefo([], 100)

    assert.deepEqual(result.allocations, [])
    assert.equal(result.shortfall, 100)
  })

  it("ignores empty batches rather than allocating from them", () => {
    const result = allocateFefo([batch("empty", 0, 5), batch("full", 100, 90)], 40)

    assert.deepEqual(result.allocations, [{ batchId: "full", quantity: 40 }])
  })

  it("sorts by expiry itself, whatever order the batches arrive in", () => {
    const shuffled = [batch("d", 10, 200), batch("a", 10, 10), batch("c", 10, 120), batch("b", 10, 60)]
    const result = allocateFefo(shuffled, 30)

    assert.deepEqual(
      result.allocations.map((allocation) => allocation.batchId),
      ["a", "b", "c"],
    )
  })

  it("does not mutate the list it was given", () => {
    const batches = [batch("b", 10, 100), batch("a", 10, 10)]
    allocateFefo(batches, 20)

    assert.deepEqual(batches.map((entry) => entry.id), ["b", "a"])
  })

  it("accepts string expiry dates from a database row", () => {
    const result = allocateFefo(
      [
        { id: "late", quantity: 100, expiryDate: inDays(200).toISOString() },
        { id: "soon", quantity: 100, expiryDate: inDays(10).toISOString() },
      ],
      10,
    )

    assert.deepEqual(result.allocations, [{ batchId: "soon", quantity: 10 }])
  })

  it("allocates nothing for a zero or negative request", () => {
    assert.deepEqual(allocateFefo([batch("a", 100, 10)], 0).allocations, [])
    assert.deepEqual(allocateFefo([batch("a", 100, 10)], -5).allocations, [])
  })

  it("hands back exactly what it reserved, so a cancel restores it", () => {
    const requested = 137
    const result = allocateFefo([batch("a", 50, 10), batch("b", 200, 60)], requested)

    assert.equal(totalAllocated(result.allocations), requested)
  })
})

describe("bestScheme", () => {
  const tiers = [
    { minQuantity: 100, discountPercent: 5 },
    { minQuantity: 50, discountPercent: 8 },
    { minQuantity: 10, discountPercent: 3 },
  ]

  it("picks the deepest tier the quantity reaches", () => {
    assert.deepEqual(bestScheme(120, tiers), { minQuantity: 100, discountPercent: 5 })
    assert.deepEqual(bestScheme(60, tiers), { minQuantity: 50, discountPercent: 8 })
  })

  it("qualifies at the threshold itself", () => {
    assert.equal(bestScheme(50, tiers)?.minQuantity, 50)
    assert.equal(bestScheme(100, tiers)?.minQuantity, 100)
  })

  it("falls back to a lower tier when the threshold is missed", () => {
    assert.deepEqual(bestScheme(12, tiers), { minQuantity: 10, discountPercent: 3 })
  })

  it("gives no scheme when nothing is reached", () => {
    assert.equal(bestScheme(5, tiers), null)
    assert.equal(bestScheme(100, []), null)
  })

  it("breaks a tie on the deeper discount", () => {
    const tied = [
      { minQuantity: 10, discountPercent: 2 },
      { minQuantity: 10, discountPercent: 11 },
    ]

    assert.equal(bestScheme(50, tied)?.discountPercent, 11)
  })
})

describe("priceLines", () => {
  it("charges GST on the discounted value, not the gross line", () => {
    const priced = priceLines([
      { quantity: 100, unitPrice: 10, gstPercent: 12, schemes: [{ minQuantity: 50, discountPercent: 10 }] },
    ])

    assert.equal(priced.lines[0].lineTotal, 1000)
    assert.equal(priced.lines[0].discount, 100)
    assert.equal(priced.lines[0].taxable, 900)
    assert.equal(priced.lines[0].gst, 108, "12% of 900, not of 1000")
    assert.equal(priced.total, 1008)
  })

  it("totals several lines", () => {
    const priced = priceLines([
      { quantity: 10, unitPrice: 5, gstPercent: 5, schemes: [] },
      { quantity: 20, unitPrice: 2.5, gstPercent: 12, schemes: [] },
    ])

    assert.equal(priced.subtotal, 100)
    assert.equal(priced.discount, 0)
    assert.equal(priced.gst, 8.5, "2.50 at 5% plus 6.00 at 12%")
    assert.equal(priced.total, 108.5)
  })

  it("keeps money to paise", () => {
    const priced = priceLines([
      { quantity: 3, unitPrice: 19.99, gstPercent: 12, schemes: [] },
    ])

    for (const value of [priced.subtotal, priced.gst, priced.total]) {
      assert.equal(value, Math.round(value * 100) / 100)
    }
  })

  it("adds up across lines that each carry a discount", () => {
    const priced = priceLines([
      { quantity: 10, unitPrice: 100, gstPercent: 0, schemes: [{ minQuantity: 10, discountPercent: 10 }] },
      { quantity: 10, unitPrice: 100, gstPercent: 0, schemes: [] },
    ])

    assert.equal(priced.subtotal, 2000)
    assert.equal(priced.discount, 100)
    assert.equal(priced.total, 1900)
  })

  it("prices an order with no lines as zero", () => {
    const priced = priceLines([])

    assert.equal(priced.subtotal, 0)
    assert.equal(priced.total, 0)
  })

  it("records the scheme it applied", () => {
    const priced = priceLines([
      { quantity: 60, unitPrice: 10, gstPercent: 0, schemes: [
        { minQuantity: 100, discountPercent: 5 },
        { minQuantity: 50, discountPercent: 8 },
      ] },
    ])

    assert.equal(priced.lines[0].scheme?.minQuantity, 50)
  })
})

describe("canTransition", () => {
  it("follows the happy path in order", () => {
    assert.ok(canTransition("PLACED", "APPROVED"))
    assert.ok(canTransition("APPROVED", "PACKED"))
    assert.ok(canTransition("PACKED", "DISPATCHED"))
    assert.ok(canTransition("DISPATCHED", "DELIVERED"))
  })

  it("allows rejection before packing", () => {
    assert.ok(canTransition("PLACED", "REJECTED"))
    assert.ok(canTransition("APPROVED", "REJECTED"))
  })

  it("refuses to skip a step", () => {
    assert.equal(canTransition("PLACED", "PACKED"), false)
    assert.equal(canTransition("PLACED", "DISPATCHED"), false)
    assert.equal(canTransition("APPROVED", "DELIVERED"), false)
  })

  it("refuses to move backwards", () => {
    assert.equal(canTransition("APPROVED", "PLACED"), false)
    assert.equal(canTransition("PACKED", "APPROVED"), false)
    assert.equal(canTransition("DISPATCHED", "PACKED"), false)
  })

  it("treats delivered, rejected and cancelled as terminal", () => {
    for (const terminal of ["DELIVERED", "REJECTED", "CANCELLED"]) {
      assert.equal(ORDER_TRANSITIONS[terminal], undefined)
      for (const target of ["APPROVED", "PACKED", "DISPATCHED", "DELIVERED", "REJECTED"]) {
        assert.equal(canTransition(terminal, target), false, `${terminal} -> ${target}`)
      }
    }
  })

  it("refuses a packed order being rejected", () => {
    assert.equal(canTransition("PACKED", "REJECTED"), false)
    assert.equal(canTransition("DISPATCHED", "REJECTED"), false)
  })
})

describe("canCancel", () => {
  it("allows cancelling before dispatch", () => {
    assert.ok(canCancel("PLACED"))
    assert.ok(canCancel("APPROVED"))
  })

  it("refuses once stock has moved", () => {
    for (const status of ["PACKED", "DISPATCHED", "DELIVERED", "REJECTED", "CANCELLED"]) {
      assert.equal(canCancel(status), false, status)
    }
  })
})
