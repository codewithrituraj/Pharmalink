/**
 * Every page, asked for by the role that is allowed to see it.
 *
 * The route tests cover the API. This one covers the documents a person actually
 * loads, because a page can be broken in ways a route test never sees: a server
 * component that throws while reading the database, a param that does not
 * resolve, a page that only works for the role it was written for. Those show up
 * as a 500 or an unexpected redirect long before anyone opens the browser.
 *
 * A page answering 200 for its own role is the bar. A page answering for the
 * wrong role is not a 200 problem but a leak, so those are checked too, and a
 * signed out visitor is expected to be sent to the login page rather than handed
 * the document.
 */
import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"

import { api, signIn, type CatalogueProduct, type PlacedOrder, type Session } from "./client"
import { grantAccess, registerRivalStockist } from "./db"
import { startServer, type TestServer } from "./server"

type Role = "stockist" | "manufacturer" | "admin"

let server: TestServer
let base: string
let stockist: Session
let manufacturer: Session
let admin: Session
let orderId: string
let orderPoNumber: string

/** A real order in another organization, to check the page will not show it. */
let rivalOrderId: string
let rivalPoNumber: string

const stockistPages = [
  "/stockist",
  "/stockist/analytics",
  "/stockist/catalogue",
  "/stockist/expiry",
  "/stockist/h1-register",
  "/stockist/insights",
  "/stockist/inventory",
  "/stockist/invoices",
  "/stockist/ledger",
  "/stockist/manufacturers",
  "/stockist/notifications",
  "/stockist/orders",
  "/stockist/returns",
]

const manufacturerPages = [
  "/manufacturer",
  "/manufacturer/access-requests",
  "/manufacturer/catalogue",
  "/manufacturer/orders",
  "/manufacturer/payments",
  "/manufacturer/reports",
  "/manufacturer/returns",
  "/manufacturer/schemes",
]

const adminPages = [
  "/admin",
  "/admin/audit",
  "/admin/compliance",
  "/admin/h1-register",
  "/admin/users",
  "/admin/verifications",
]

const publicPages = ["/login", "/register"]

/** Every page, with the role that owns it. */
const ownedPages: { path: string; owner: Role }[] = [
  ...stockistPages.map((path) => ({ path, owner: "stockist" as Role })),
  ...manufacturerPages.map((path) => ({ path, owner: "manufacturer" as Role })),
  ...adminPages.map((path) => ({ path, owner: "admin" as Role })),
]

const allRoles: Role[] = ["stockist", "manufacturer", "admin"]

/**
 * The sessions are looked up by role inside each test, never captured in a table
 * at collection time.
 *
 * A `describe` body runs before its `before` hook has signed anyone in, so a
 * table built out here would hold the sessions as they were while the file was
 * being collected, which is to say undefined. Every request would then go out
 * with no cookie, a 200 expectation would fail, and a "the wrong role is
 * refused" expectation would pass without ever testing a signed in caller.
 */
function sessionFor(role: Role): Session {
  const session = role === "stockist" ? stockist : role === "manufacturer" ? manufacturer : admin
  assert.ok(session?.cookie, `no session for ${role}; the sign-in did not run`)
  return session
}

/** Loads a page without following the redirect, so the status is the one sent. */
async function load(path: string, session: Session | null): Promise<number> {
  const res = await fetch(`${base}${path}`, {
    headers: session ? { cookie: session.cookie } : {},
    redirect: "manual",
  })
  return res.status
}

/**
 * Loads a page and returns the HTML it actually renders.
 *
 * The scripts are stripped first, because a page's RSC payload is inlined into
 * the same document and carries the text of pages the browser has not navigated
 * to yet. A check for a phrase against the raw response therefore matches text
 * the user never sees, which is how a check for the 404 copy can pass on a page
 * that is not the 404.
 */
async function html(path: string, session: Session | null): Promise<string> {
  const res = await fetch(`${base}${path}`, {
    headers: session ? { cookie: session.cookie } : {},
    redirect: "manual",
  })
  return (await res.text()).replace(/<script[\s\S]*?<\/script>/g, "")
}

/** Loads a page and returns the status along with the rendered HTML. */
async function page(path: string, session: Session | null): Promise<{ status: number; html: string }> {
  const res = await fetch(`${base}${path}`, {
    headers: session ? { cookie: session.cookie } : {},
    redirect: "manual",
  })
  return { status: res.status, html: (await res.text()).replace(/<script[\s\S]*?<\/script>/g, "") }
}

/** A real order belonging to the seeded stockist, for the dynamic order page. */
async function anyOrder(): Promise<{ id: string; poNumber: string | null }> {
  const res = await api<unknown[]>(base, stockist, "/api/stockist/orders")
  assert.equal(res.status, 200, `the stockist should be able to list orders: ${JSON.stringify(res.body)}`)
  const first = res.body[0] as { id?: string; poNumber?: string | null } | undefined
  assert.ok(first?.id, "the seed should give the stockist at least one order")
  return { id: first.id, poNumber: first.poNumber ?? null }
}

/**
 * Places an order for a stockist in a different organization.
 *
 * The detail page reads the order on the server now, so whether it will refuse
 * an id it does not own is decided before anything is rendered. That needs a
 * genuine second organization's order to point at, not a made up id, which the
 * page would reject for the wrong reason.
 */
async function placeOrderFor(email: string): Promise<{ id: string; poNumber: string | null }> {
  const session = await signIn(base, email)
  const search = await api<{ products: CatalogueProduct[] }>(base, session, "/api/stockist/search")
  const product = (search.body.products ?? []).find((item) => (item.batches ?? []).length > 0)
  assert.ok(product, `${email} should have something to order`)
  const placed = await api<PlacedOrder>(base, session, "/api/stockist/orders", {
    method: "POST",
    body: {
      manufacturerId: product.manufacturerId,
      items: [{ productId: product.id, quantity: Math.max(1, product.minOrderQty) }],
    },
  })
  assert.equal(placed.status, 200, `${email} should be able to order: ${placed.body?.error}`)
  return {
    id: placed.body.order.id,
    poNumber: (placed.body.order as unknown as { poNumber?: string | null }).poNumber ?? null,
  }
}

before(async () => {
  server = await startServer()
  base = server.base
  ;[stockist, manufacturer, admin] = await Promise.all([
    signIn(base, "stockist@city.com"),
    signIn(base, "mfr@apex.com"),
    signIn(base, "admin@pharmalink.com"),
  ])
  const mine = await anyOrder()
  orderId = mine.id
  orderPoNumber = mine.poNumber ?? ""

  const rivalEmail = await registerRivalStockist(base)
  await grantAccess(rivalEmail, "Apex Pharma")
  const theirs = await placeOrderFor(rivalEmail)
  rivalOrderId = theirs.id
  rivalPoNumber = theirs.poNumber ?? ""
})

after(async () => {
  await server?.stop()
  const { disconnect } = await import("./db")
  await disconnect()
})

describe("pages answer the role that owns them", () => {
  for (const { path, owner } of ownedPages) {
    it(`${path} loads for its own role`, async () => {
      const status = await load(path, sessionFor(owner))
      assert.equal(status, 200, `${path} answered ${status} instead of rendering`)
    })
  }

  it("/stockist/orders/[id] loads for a real order", async () => {
    const status = await load(`/stockist/orders/${orderId}`, sessionFor("stockist"))
    assert.equal(status, 200, "an order that exists should render")
  })
})

describe("the order page answers 200 whatever the id is", () => {
  it("shows the order when it is the stockist's own", async () => {
    const body = await html(`/stockist/orders/${orderId}`, sessionFor("stockist"))
    assert.ok(orderPoNumber.length > 0, "the seeded order should have a PO number")
    assert.ok(
      body.includes(orderPoNumber),
      "the page should show the order it was asked for",
    )
  })

  it("says so, and still answers 200, for an order that does not exist", async () => {
    const missing = "/stockist/orders/00000000-0000-0000-0000-000000000000"
    const status = await load(missing, sessionFor("stockist"))
    assert.equal(status, 200, "a mistyped id is not a server error")
    const body = await html(missing, sessionFor("stockist"))
    assert.ok(
      body.includes("Order not found"),
      "the page should say the order is not there rather than crash",
    )
  })

  it("says not found for an id that is not even an id", async () => {
    const status = await load("/stockist/orders/not-a-real-id", sessionFor("stockist"))
    assert.equal(status, 200)
    const body = await html("/stockist/orders/not-a-real-id", sessionFor("stockist"))
    assert.ok(body.includes("Order not found"))
  })

  it("will not show another organization's order", async () => {
    const body = await html(`/stockist/orders/${rivalOrderId}`, sessionFor("stockist"))
    assert.ok(
      body.includes("Order not found"),
      "an order belonging to another organization must read as not found",
    )
    if (rivalPoNumber.length > 0) {
      assert.ok(
        !body.includes(rivalPoNumber),
        "the page leaked another organization's PO number",
      )
    }
  })
})

describe("pages that need no account", () => {
  for (const path of publicPages) {
    it(`${path} loads for a signed out visitor`, async () => {
      assert.equal(await load(path, null), 200)
    })
  }
})

describe("pages are not handed to the wrong role", () => {
  for (const { path, owner } of ownedPages) {
    it(`${path} is refused to the other two roles`, async () => {
      for (const role of allRoles) {
        if (role === owner) continue
        const status = await load(path, sessionFor(role))
        assert.ok(
          status === 307 || status === 302 || status === 401 || status === 403,
          `${path} answered ${status} to a signed in ${role}, which does not own it`,
        )
      }
    })
  }

  it("the root sends each role to its own dashboard", async () => {
    for (const role of allRoles) {
      const res = await fetch(`${base}/`, {
        headers: { cookie: sessionFor(role).cookie },
        redirect: "manual",
      })
      assert.equal(res.status, 307)
      assert.equal(res.headers.get("location"), `/${role}`)
    }
  })
})

describe("an address that is not part of the app", () => {
  const unknownPaths = ["/nonsense", "/stockist/nonsense", "/manufacturer/nope", "/admin/xyz"]

  for (const path of unknownPaths) {
    it(`${path} answers 404 with the app's own page`, async () => {
      const { status, html: body } = await page(path, null)
      assert.equal(status, 404, `${path} should be a 404, not a redirect or a 200`)
      assert.ok(
        body.includes("Nothing at this address"),
        `${path} should render the app's 404 page, not Next's default one`,
      )
    })
  }

  it("offers a way back, and marks itself noindex", async () => {
    const { html: body } = await page("/nonsense", null)
    assert.ok(body.includes("Go to sign in"), "the 404 page should link somewhere useful")
    assert.ok(body.includes("noindex"), "a 404 should not be indexed")
  })

  it("shows the same 404 whether signed in or not", async () => {
    const out = await page("/stockist/nonsense", null)
    const signedIn = await page("/stockist/nonsense", sessionFor("stockist"))
    assert.equal(signedIn.status, 404)
    assert.ok(
      signedIn.html.includes("Nothing at this address"),
      "a signed in visitor should get the same page, not a broken one",
    )
    assert.ok(out.html.includes("Nothing at this address"))
  })

  it("does not answer a 404 for a real page", async () => {
    // The order page reads its own order and renders its own not-found card, so
    // it must not be reached by the 404 page and it must stay a 200.
    const { status, html: body } = await page("/stockist/orders/not-a-real-id", sessionFor("stockist"))
    assert.equal(status, 200)
    assert.ok(body.includes("Order not found"))
    assert.ok(
      !body.includes("Nothing at this address"),
      "a stockist's mistyped order id should use the order page's own message",
    )
  })
})

describe("a signed out visitor is sent to the login page", () => {
  for (const { path } of ownedPages) {
    it(`${path} redirects to login`, async () => {
      const res = await fetch(`${base}${path}`, { redirect: "manual" })
      assert.ok(
        res.status === 307 || res.status === 302,
        `${path} answered ${res.status} to a visitor with no session`,
      )
      assert.equal(res.headers.get("location"), "/login")
    })
  }
})
