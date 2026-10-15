/**
 * Every API route, probed with the wrong caller.
 *
 * The order lifecycle tests cover the rules inside the order routes. This asks
 * a different question of all 27 routes at once: does anything answer a caller
 * it should have refused? In a system where every organization is a separate
 * customer, a route that answers the wrong role or the wrong organization is
 * the one mistake that cannot be walked back.
 *
 * A route that is working correctly answers 401, or 403, or 404. Anything in
 * the 2xx range is a leak, and so is a 500 that happens before the caller is
 * turned away, since that means the route did work for someone who should not
 * have reached it.
 *
 * The bodies are deliberately vague. A refusal that depends on the body being
 * exactly right is not a refusal.
 */
import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"

import { api, signIn, type CatalogueProduct, type PlacedOrder, type Session } from "./client"
import { grantAccess, registerRivalStockist } from "./db"
import { startServer, type TestServer } from "./server"

type Probe = { path: string; method: string; body?: unknown }

/** A placeholder id: these probes never expect to get past an ownership check. */
const SOME_ID = "00000000-0000-0000-0000-000000000000"

const stockistRoutes: Probe[] = [
  { path: "/api/stockist/analytics/spend", method: "GET" },
  { path: "/api/stockist/drafts", method: "GET" },
  { path: "/api/stockist/drafts", method: "POST", body: {} },
  { path: "/api/stockist/expiry", method: "GET" },
  { path: "/api/stockist/favourites", method: "GET" },
  { path: "/api/stockist/h1-register", method: "GET" },
  { path: "/api/stockist/insights", method: "GET" },
  { path: "/api/stockist/insights/forecast", method: "GET" },
  { path: "/api/stockist/inventory", method: "GET" },
  { path: "/api/stockist/inventory", method: "POST", body: {} },
  { path: "/api/stockist/invoices", method: "GET" },
  { path: "/api/stockist/ledger", method: "GET" },
  { path: `/api/stockist/inventory/${SOME_ID}`, method: "PATCH", body: { quantity: 1 } },
  { path: `/api/stockist/inventory/${SOME_ID}`, method: "DELETE" },
  { path: "/api/stockist/manufacturers", method: "GET" },
  { path: "/api/stockist/manufacturers", method: "POST", body: {} },
  { path: "/api/stockist/notifications", method: "GET" },
  { path: "/api/stockist/notifications", method: "PATCH", body: { all: true } },
  { path: "/api/stockist/orders", method: "GET" },
  { path: "/api/stockist/orders", method: "POST", body: {} },
  { path: `/api/stockist/orders/${SOME_ID}`, method: "GET" },
  { path: `/api/stockist/orders/${SOME_ID}`, method: "PATCH", body: { action: "CANCEL" } },
  { path: `/api/stockist/orders/${SOME_ID}/pdf`, method: "GET" },
  { path: "/api/stockist/products", method: "GET" },
  { path: `/api/stockist/products/${SOME_ID}`, method: "GET" },
  { path: `/api/stockist/products/${SOME_ID}/favourite`, method: "POST" },
  { path: "/api/stockist/reorder", method: "GET" },
  { path: "/api/stockist/reorder", method: "POST", body: {} },
  { path: "/api/stockist/returns", method: "GET" },
  { path: "/api/stockist/returns", method: "POST", body: {} },
  { path: "/api/stockist/search", method: "GET" },
]

const manufacturerRoutes: Probe[] = [
  { path: "/api/manufacturer/access", method: "GET" },
  { path: "/api/manufacturer/access", method: "POST", body: {} },
  { path: "/api/manufacturer/catalogue", method: "POST", body: {} },
  { path: "/api/manufacturer/orders", method: "GET" },
  { path: "/api/manufacturer/payments", method: "GET" },
  { path: "/api/manufacturer/payments", method: "PATCH", body: {} },
  { path: "/api/manufacturer/products", method: "GET" },
  { path: "/api/manufacturer/products", method: "POST", body: {} },
  { path: "/api/manufacturer/reports", method: "GET" },
  { path: "/api/manufacturer/returns", method: "GET" },
  { path: "/api/manufacturer/returns", method: "PATCH", body: {} },
  { path: "/api/manufacturer/schemes", method: "GET" },
  { path: "/api/manufacturer/schemes", method: "POST", body: {} },
  { path: `/api/manufacturer/orders/${SOME_ID}/status`, method: "PATCH", body: { status: "APPROVED" } },
]

const adminRoutes: Probe[] = [
  { path: "/api/admin/audit", method: "GET" },
  { path: "/api/admin/compliance", method: "GET" },
  { path: "/api/admin/h1-register", method: "GET" },
  { path: "/api/admin/users", method: "GET" },
  { path: "/api/admin/users", method: "PATCH", body: {} },
  { path: "/api/admin/verify", method: "GET" },
  { path: "/api/admin/verify", method: "POST", body: {} },
  { path: "/api/jobs/runs", method: "GET" },
]

/** Statuses that count as "turned away". */
const REFUSALS = new Set([400, 401, 403, 404, 405, 422])

let server: TestServer
let base: string
let stockist: Session
let manufacturer: Session
let admin: Session

/** A stockist belonging to a different organization, used to test isolation. */
let rival: Session

/** How many ids appear in both lists, which is how a cross-tenant leak shows. */
function overlap(a: { id: string }[], b: { id: string }[]): number {
  const seen = new Set(a.map((row) => row.id))
  return b.filter((row) => seen.has(row.id)).length
}

/**
 * Pulls the rows out of a response, insisting they are there.
 *
 * A leak check is only worth running on rows it can actually see. An earlier
 * version of this file read `body.orders` off a response that turned out to be a
 * bare array, so both sides were undefined, they overlapped in zero ids, and
 * the test reported no leak while comparing nothing at all. A missing field and
 * an empty field now fail loudly here instead of passing quietly.
 */
function requireRows(value: unknown, what: string): { id: string }[] {
  assert.ok(
    Array.isArray(value),
    `expected a list for ${what}, got ${JSON.stringify(value ?? null).slice(0, 120)}`,
  )
  const list = value as { id: string }[]
  assert.ok(list.length > 0, `${what} was empty, so the check would prove nothing`)
  return list
}

/** Same, for a list nested under a key. */
function rowsFrom(body: unknown, key: string): { id: string }[] {
  return requireRows((body as Record<string, unknown>)[key], `body.${key}`)
}

/**
 * Names a probe by the role that makes the call.
 *
 * The name has to be written here rather than derived from the session object,
 * because a `describe` body runs before its `before` hook has signed anyone in.
 * Naming a test from a value that is still undefined labels it wrongly, and a
 * mislabelled failure sends you looking for a problem in the wrong place.
 */
type Caller = "anonymous" | "stockist" | "manufacturer" | "admin"

function describeProbe(probe: Probe, caller: Caller) {
  return `${probe.method} ${probe.path} as ${caller}`
}

before(async () => {
  server = await startServer()
  base = server.base
  ;[stockist, manufacturer, admin] = await Promise.all([
    signIn(base, "stockist@city.com"),
    signIn(base, "mfr@apex.com"),
    signIn(base, "admin@pharmalink.com"),
  ])
  const rivalEmail = await registerRivalStockist(base)
  rival = await signIn(base, rivalEmail)
  await grantAccess(rivalEmail, "Apex Pharma")
  await placeAndDeliver(stockist, "the seeded stockist")
  await placeAndDeliver(rival, "the rival")
})

/**
 * Gives an organization data of its own, so the isolation checks below have two
 * non-empty lists to compare.
 *
 * A brand new organization has no orders, no inventory and no notifications, and
 * the seeded stockist has no notifications either unless the scheduled jobs have
 * run. Comparing either of them against the other proves nothing: an empty list
 * overlaps an empty list in zero ids whether the routes are correctly scoped or
 * leaking everything. So both sides place a real order and the manufacturer
 * delivers it, which is the only path that creates rows in all three places at
 * once. It uses the public routes, so the data arrives the way a customer's
 * would.
 */
async function placeAndDeliver(session: Session, who: string) {
  const search = await api<{ products: CatalogueProduct[] }>(base, session, "/api/stockist/search")
  assert.equal(search.status, 200, `${who} should be able to search the catalogue`)
  const product = (search.body.products ?? []).find((item) => (item.batches ?? []).length > 0)
  assert.ok(product, `the seed should provide ${who} something to order`)

  const placed = await api<PlacedOrder>(base, session, "/api/stockist/orders", {
    method: "POST",
    body: {
      manufacturerId: product.manufacturerId,
      items: [{ productId: product.id, quantity: Math.max(1, product.minOrderQty) }],
    },
  })
  assert.equal(placed.status, 200, `${who} should be able to order: ${placed.body?.error}`)
  const orderId = placed.body?.order?.id
  assert.ok(orderId, `${who}'s order should have an id`)

  for (const status of ["APPROVED", "PACKED", "DISPATCHED", "DELIVERED"]) {
    const res = await api<{ error?: string }>(base, manufacturer, `/api/manufacturer/orders/${orderId}/status`, {
      method: "PATCH",
      body: status === "DISPATCHED" ? { status, transporter: "Integration Logistics", trackingNumber: `INT-${orderId.slice(-8)}` } : { status },
    })
    assert.equal(res.status, 200, `delivering ${who}'s order at ${status}: ${res.body?.error}`)
  }
}

after(async () => {
  await server?.stop()
  const { disconnect } = await import("./db")
  await disconnect()
})

describe("anonymous callers are turned away", () => {
  const everyRoute = [...stockistRoutes, ...manufacturerRoutes, ...adminRoutes]

  for (const probe of everyRoute) {
    if (probe.path.startsWith("/api/stockist/notifications/stream")) continue
    it(describeProbe(probe, "anonymous"), async () => {
      const res = await api(base, null, probe.path, { method: probe.method, body: probe.body })
      assert.ok(
        REFUSALS.has(res.status),
        `expected a refusal, got ${res.status} ${JSON.stringify(res.body)}`,
      )
      assert.notEqual(res.status, 500, "the route did work before refusing the caller")
    })
  }
})

describe("a manufacturer cannot use a stockist route", () => {
  for (const probe of stockistRoutes) {
    it(describeProbe(probe, "manufacturer"), async () => {
      const res = await api(base, manufacturer, probe.path, { method: probe.method, body: probe.body })
      assert.ok(
        REFUSALS.has(res.status),
        `expected a refusal, got ${res.status} ${JSON.stringify(res.body)}`,
      )
      assert.notEqual(res.status, 500, "the route did work before refusing the caller")
    })
  }
})

describe("an admin cannot use a stockist route", () => {
  for (const probe of stockistRoutes) {
    it(describeProbe(probe, "admin"), async () => {
      const res = await api(base, admin, probe.path, { method: probe.method, body: probe.body })
      assert.ok(
        REFUSALS.has(res.status),
        `expected a refusal, got ${res.status} ${JSON.stringify(res.body)}`,
      )
      assert.notEqual(res.status, 500, "the route did work before refusing the caller")
    })
  }
})

describe("a stockist cannot use a manufacturer or admin route", () => {
  for (const probe of [...manufacturerRoutes, ...adminRoutes]) {
    it(describeProbe(probe, "stockist"), async () => {
      const res = await api(base, stockist, probe.path, { method: probe.method, body: probe.body })
      assert.ok(
        REFUSALS.has(res.status),
        `expected a refusal, got ${res.status} ${JSON.stringify(res.body)}`,
      )
      assert.notEqual(res.status, 500, "the route did work before refusing the caller")
    })
  }
})

describe("a stockist cannot read another organization's data", () => {
  it("does not list another stockist's orders", async () => {
    // This endpoint answers with a bare array, not a wrapper object, so the
    // rows are read off the body itself.
    const mine = await api<unknown>(base, stockist, "/api/stockist/orders")
    const theirs = await api<unknown>(base, rival, "/api/stockist/orders")
    assert.equal(mine.status, 200)
    assert.equal(theirs.status, 200)
    assert.equal(
      overlap(requireRows(mine.body, "orders"), requireRows(theirs.body, "orders")),
      0,
      "two organizations saw the same orders",
    )
  })

  it("does not expose another stockist's inventory", async () => {
    const mine = await api<unknown>(base, stockist, "/api/stockist/inventory")
    const theirs = await api<unknown>(base, rival, "/api/stockist/inventory")
    assert.equal(
      overlap(rowsFrom(mine.body, "batches"), rowsFrom(theirs.body, "batches")),
      0,
      "two organizations saw the same inventory batches",
    )
  })

  it("does not show another stockist's notifications", async () => {
    const mine = await api<unknown>(base, stockist, "/api/stockist/notifications")
    const theirs = await api<unknown>(base, rival, "/api/stockist/notifications")
    assert.equal(
      overlap(rowsFrom(mine.body, "notifications"), rowsFrom(theirs.body, "notifications")),
      0,
      "two organizations saw the same notifications",
    )
  })
})

describe("admin user data is safe to return to the browser", () => {
  it("never serializes password hashes", async () => {
    const response = await api<Record<string, unknown>[]>(base, admin, "/api/admin/users")
    assert.equal(response.status, 200)
    assert.ok(response.body.length > 0, "the seeded user list should not be empty")
    for (const user of response.body) {
      assert.equal("password" in user, false, `password material leaked for ${String(user.email)}`)
    }
  })
})
