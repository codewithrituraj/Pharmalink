import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { buildPriceComparison } from "../src/lib/price-comparison"

describe("buildPriceComparison", () => {
  it("applies quantity schemes and GST, then ranks by estimated unit cost", () => {
    const offers = buildPriceComparison(
      [
        {
          id: "offer-a",
          name: "Brand A",
          genericName: "Generic",
          strength: "500 mg",
          dosageForm: "Tablet",
          ptr: 10,
          gstPercent: 12,
          minOrderQty: 10,
          leadTimeDays: 3,
          manufacturer: { name: "Maker A" },
          batches: [{ quantity: 200 }],
          schemes: [{ name: "Volume offer", minQuantity: 20, discountPercent: 10 }],
        },
        {
          id: "offer-b",
          name: "Brand B",
          genericName: "Generic",
          strength: "500 mg",
          dosageForm: "Tablet",
          ptr: 9.5,
          gstPercent: 12,
          minOrderQty: 5,
          leadTimeDays: 5,
          manufacturer: { name: "Maker B" },
          batches: [{ quantity: 100 }],
          schemes: [],
        },
      ],
      20,
    )

    assert.equal(offers[0].id, "offer-a")
    assert.equal(offers[0].ptrAfterScheme, 9)
    assert.equal(offers[0].estimatedUnitIncludingGst, 10.08)
    assert.equal(offers[0].schemeName, "Volume offer")
    assert.equal(offers[0].meetsMoq, true)
  })
})