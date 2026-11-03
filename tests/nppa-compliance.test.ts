import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { exceedsNppaCeiling } from "../src/lib/nppa-compliance"

describe("exceedsNppaCeiling", () => {
  it("allows an MRP equal to the ceiling after paise rounding", () => {
    assert.equal(exceedsNppaCeiling(10.001, 10), false)
  })

  it("flags an MRP one paisa above the ceiling", () => {
    assert.equal(exceedsNppaCeiling(10.01, 10), true)
  })
})