import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { buildOutstandingLedger } from "../src/lib/ledger"

describe("buildOutstandingLedger", () => {
  it("totals unpaid invoices into invoice-age buckets", () => {
    const asOf = new Date("2026-10-01T00:00:00.000Z")
    const ledger = buildOutstandingLedger(
      [
        { id: "a", invoiceNumber: "INV-A", poNumber: "PO-A", createdAt: "2026-09-21", total: 100, seller: { name: "Maker A" } },
        { id: "b", invoiceNumber: "INV-B", poNumber: "PO-B", invoiceCreatedAt: "2026-08-15", createdAt: "2026-08-15", total: 200 },
        { id: "c", invoiceNumber: "INV-C", poNumber: "PO-C", invoiceCreatedAt: "2026-07-15", createdAt: "2026-07-15", total: 300 },
        { id: "d", invoiceNumber: "INV-D", poNumber: "PO-D", invoiceCreatedAt: "2026-06-01", createdAt: "2026-06-01", total: 400 },
      ],
      asOf,
    )

    assert.equal(ledger.totalOutstanding, 1000)
    assert.equal(ledger.invoiceCount, 4)
    assert.deepEqual(ledger.aging, {
      days0To30: 100,
      days31To60: 200,
      days61To90: 300,
      over90Days: 400,
    })
    assert.equal(ledger.invoices[0].manufacturer, "Maker A")
  })
})