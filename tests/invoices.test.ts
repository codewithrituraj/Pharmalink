import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { buildInvoiceSummary } from "../src/lib/invoices"

describe("buildInvoiceSummary", () => {
  it("returns an invoice summary and keeps the manufacturer and total data intact", () => {
    const summary = buildInvoiceSummary({
      id: "ord_1",
      poNumber: "PO-1001",
      invoiceNumber: "INV-1001",
      invoiceCreatedAt: new Date("2026-08-29T10:30:06.475Z"),
      status: "DELIVERED",
      total: 48688.64,
      subtotal: 45760,
      discount: 2288,
      gst: 5216.64,
      seller: { name: "BioCure Labs" },
      buyer: { name: "City Medicos" },
      items: [
        { product: { name: "Paramax BioCure 2", hsnCode: "3004" }, quantity: 145, price: 11 },
      ],
    })

    assert.equal(summary.invoiceNumber, "INV-1001")
    assert.equal(summary.manufacturer, "BioCure Labs")
    assert.equal(summary.total, 48688.64)
    assert.equal(summary.items[0].product.name, "Paramax BioCure 2")
    assert.equal(summary.items[0].product.hsnCode, "3004")
  })
})
