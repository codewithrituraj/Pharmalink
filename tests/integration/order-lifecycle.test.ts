/**
 * The order lifecycle, exercised through HTTP against a running server.
 *
 * The unit tests in tests/ cover the rules in src/lib/orders.ts in isolation.
 * These cover the things only a real request can show: that the routes call
 * those rules, that ownership is enforced against a live session, and that a
 * cancellation puts stock back. Each test states the behaviour it is pinning
 * down rather than the code path it exercises.
 *
 * These tests need a seeded database and a production build, so they are kept
 * out of `npm test` and run with `npm run test:integration`.
 */
import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"

import {
  api,
  signIn,
  type CatalogueProduct,
  type ErrorBody,
  type PlacedOrder,
  type Session,
} from "./client"
import { allocationsFor, disconnect, manufacturerPool, registerRivalStockist } from "./db"
import { startServer, type TestServer } from "./server"

let server: TestServer
let base: string
let stockist: Session
let manufacturer: Session
let admin: Session
let rival: Session

/** A catalogue product with at least two batches, so FEFO has a real choice. */
let product: CatalogueProduct

before(async () => {
  server = await startServer()
  base = server.base
  ;[stockist, manufacturer, admin] = await Promise.all([
    signIn(base, "stockist@city.com"),
    signIn(base, "mfr@apex.com"),
    signIn(base, "admin@pharmalink.com"),
  ])
  // A second stockist in an unrelated organization, so "does not leak" can be
  // tested against a genuine outsider rather than a second session of the same
  // organization.
  rival = await signIn(base, await registerRivalStockist(base))

  const search = await api<{ products: CatalogueProduct[] }>(base, stockist, "/api/stockist/search")
  assert.equal(search.status, 200, "search should return the catalogue")
  const products = search.body.products ?? []
  const candidate = products.find((item) => (item.batches ?? []).length >= 2)
  assert.ok(candidate, "seed should provide a product with several batches")
  product = candidate
})

after(async () => {
  await server?.stop()
  await disconnect()
})

describe("placing an order", () => {
  it("refuses a line below the product's minimum order quantity", async () => {
    const res = await api<PlacedOrder>(base, stockist, "/api/stockist/orders", {
      method: "POST",
      body: {
        manufacturerId: product.manufacturerId,
        items: [{ productId: product.id, quantity: Math.max(1, product.minOrderQty - 1) }],
      },
    })
    assert.equal(res.status, 400)
    assert.match(String(res.body.error), /minimum order/i)
  })

  it("derives the manufacturer from products instead of trusting a spoofed manufacturer id", async () => {
    const res = await api<PlacedOrder>(base, stockist, "/api/stockist/orders", {
      method: "POST",
      body: {
        manufacturerId: "00000000-0000-0000-0000-000000000000",
        items: [{ productId: product.id, quantity: product.minOrderQty }],
      },
    })
    assert.equal(res.status, 200, res.body?.error)
  })

  it("takes stock from the soonest-expiring batch first", async () => {
    const pool = await manufacturerPool(product.id)
    const soonest = [...pool.values()].sort(
      (a, b) => a.expiryDate.getTime() - b.expiryDate.getTime(),
    )[0]
    assert.ok(soonest, "the product should have stock to allocate")

    const res = await api<PlacedOrder>(base, stockist, "/api/stockist/orders", {
      method: "POST",
      body: {
        manufacturerId: product.manufacturerId,
        items: [{ productId: product.id, quantity: product.minOrderQty }],
      },
    })
    assert.equal(res.status, 200, res.body?.error)

    const allocations = await allocationsFor(res.body.order.id)
    assert.ok(allocations.length > 0, "the order should record allocations")
    assert.equal(
      allocations[0].batchId,
      soonest.id,
      `expected ${soonest.batchNumber} (${soonest.expiryDate.toISOString().slice(0, 10)}) first`,
    )

    const total = allocations.reduce((sum, row) => sum + row.quantity, 0)
    assert.equal(total, product.minOrderQty, "should allocate exactly what was ordered")

    const after = await manufacturerPool(product.id)
    assert.equal(
      after.get(soonest.id)!.quantity,
      soonest.quantity - (allocations[0]?.quantity ?? 0),
      "the reserved batch should be decremented by exactly what was allocated",
    )
  })

  it("prices the order as subtotal less discount plus GST", async () => {
    const res = await api<PlacedOrder>(base, stockist, "/api/stockist/orders", {
      method: "POST",
      body: {
        manufacturerId: product.manufacturerId,
        items: [{ productId: product.id, quantity: product.minOrderQty }],
      },
    })
    assert.equal(res.status, 200, res.body?.error)

    const { subtotal, discount, gst, total } = res.body
    const expected = Math.round((subtotal - discount + gst) * 100) / 100
    assert.equal(Math.round(total * 100) / 100, expected)
  })
})

describe("who can see and drive an order", () => {
  let orderId: string

  before(async () => {
    const res = await api<PlacedOrder>(base, stockist, "/api/stockist/orders", {
      method: "POST",
      body: {
        manufacturerId: product.manufacturerId,
        items: [{ productId: product.id, quantity: product.minOrderQty }],
      },
    })
    assert.equal(res.status, 200, res.body?.error)
    orderId = res.body.order.id
  })

  it("hides the order from a stockist in another organization", async () => {
    const res = await api(base, rival, `/api/stockist/orders/${orderId}`)
    assert.ok(
      res.status === 404 || res.status === 401,
      `expected an outsider to be refused, got ${res.status}`,
    )
  })

  it("refuses a manufacturer on the stockist order route", async () => {
    const res = await api(base, manufacturer, `/api/stockist/orders/${orderId}`)
    assert.equal(res.status, 401)
  })

  it("refuses an admin on the stockist order route", async () => {
    const res = await api(base, admin, "/api/stockist/orders")
    assert.equal(res.status, 403)
  })

  it("refuses a stockist driving the manufacturer status route", async () => {
    const res = await api(base, stockist, `/api/manufacturer/orders/${orderId}/status`, {
      method: "PATCH",
      body: { status: "APPROVED" },
    })
    assert.equal(res.status, 403)
  })
})

describe("the status machine", () => {
  let orderId: string

  before(async () => {
    const res = await api<PlacedOrder>(base, stockist, "/api/stockist/orders", {
      method: "POST",
      body: {
        manufacturerId: product.manufacturerId,
        items: [{ productId: product.id, quantity: product.minOrderQty }],
      },
    })
    assert.equal(res.status, 200, res.body?.error)
    orderId = res.body.order.id
  })

  it("will not skip from placed straight to delivered", async () => {
    const res = await api<ErrorBody>(base, manufacturer, `/api/manufacturer/orders/${orderId}/status`, {
      method: "PATCH",
      body: { status: "DELIVERED" },
    })
    assert.equal(res.status, 409)
  })

  it("walks the order through to delivery one step at a time", async () => {
    for (const status of ["APPROVED", "PACKED", "DISPATCHED", "DELIVERED"]) {
      const res = await api<ErrorBody>(base, manufacturer, `/api/manufacturer/orders/${orderId}/status`, {
        method: "PATCH",
        body: status === "DISPATCHED" ? { status, transporter: "Integration Logistics", trackingNumber: `INT-${orderId.slice(-8)}` } : { status },
      })
      assert.equal(res.status, 200, `moving to ${status}: ${res.body?.error}`)
    }
  })

  it("will not move a delivered order backwards", async () => {
    const res = await api<ErrorBody>(base, manufacturer, `/api/manufacturer/orders/${orderId}/status`, {
      method: "PATCH",
      body: { status: "APPROVED" },
    })
    assert.equal(res.status, 409)
  })

  it("will not cancel an order that has been delivered", async () => {
    const res = await api<ErrorBody>(base, stockist, `/api/stockist/orders/${orderId}`, {
      method: "PATCH",
      body: { action: "CANCEL" },
    })
    assert.equal(res.status, 409)
  })
})

describe("cancelling an order", () => {
  it("returns every reserved unit to the batch it came from", async () => {
    const before = await manufacturerPool(product.id)

    const placed = await api<PlacedOrder>(base, stockist, "/api/stockist/orders", {
      method: "POST",
      body: {
        manufacturerId: product.manufacturerId,
        items: [{ productId: product.id, quantity: product.minOrderQty }],
      },
    })
    assert.equal(placed.status, 200, placed.body?.error)
    const orderId = placed.body.order.id

    // Confirm the order really did hold stock back, otherwise a cancellation
    // that restored nothing would pass the check below.
    const reserved = await manufacturerPool(product.id)
    const held = [...before].filter(([id, batch]) => reserved.get(id)!.quantity < batch.quantity)
    assert.ok(held.length > 0, "the order should have reserved stock before cancellation")

    const cancelled = await api<ErrorBody>(base, stockist, `/api/stockist/orders/${orderId}`, {
      method: "PATCH",
      body: { action: "CANCEL" },
    })
    assert.equal(cancelled.status, 200, cancelled.body?.error)

    const after = await manufacturerPool(product.id)
    for (const [id, batch] of before) {
      assert.equal(
        after.get(id)!.quantity,
        batch.quantity,
        `batch ${id} should be back at ${batch.quantity} after cancellation`,
      )
    }
  })

  it("refuses to cancel the same order twice", async () => {
    const placed = await api<PlacedOrder>(base, stockist, "/api/stockist/orders", {
      method: "POST",
      body: {
        manufacturerId: product.manufacturerId,
        items: [{ productId: product.id, quantity: product.minOrderQty }],
      },
    })
    const orderId = placed.body.order.id

    const first = await api<ErrorBody>(base, stockist, `/api/stockist/orders/${orderId}`, {
      method: "PATCH",
      body: { action: "CANCEL" },
    })
    assert.equal(first.status, 200)

    const second = await api<ErrorBody>(base, stockist, `/api/stockist/orders/${orderId}`, {
      method: "PATCH",
      body: { action: "CANCEL" },
    })
    assert.equal(second.status, 409, "a cancelled order must not release stock twice")
  })
})
