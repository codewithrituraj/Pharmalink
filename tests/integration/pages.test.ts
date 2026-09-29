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

import { api, signIn, type Session } from "./client"
import { startServer, type TestServer } from "./server"

type Role = "stockist" | "manufacturer" | "admin"

let server: TestServer
let base: string
let stockist: Session
let manufacturer: Session
let admin: Session
let orderId: string

const stockistPages = [
  "/stockist",
  "/stockist/analytics",
  "/stockist/catalogue",
  "/stockist/expiry",
  "/stockist/insights",
  "/stockist/inventory",
  "/stockist/manufacturers",
  "/stockist/notifications",
  "/stockist/orders",
]

const manufacturerPages = [
  "/manufacturer",
  "/manufacturer/access-requests",
  "/manufacturer/catalogue",
]

const adminPages = ["/admin", "/admin/verifications"]

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

/** A real order belonging to the seeded stockist, for the dynamic order page. */
async function anyOrderId(): Promise<string> {
  const res = await api<unknown[]>(base, stockist, "/api/stockist/orders")
  assert.equal(res.status, 200, `the stockist should be able to list orders: ${JSON.stringify(res.body)}`)
  const first = res.body[0] as { id?: string } | undefined
  assert.ok(first?.id, "the seed should give the stockist at least one order")
  return first.id
}

before(async () => {
  server = await startServer()
  base = server.base
  ;[stockist, manufacturer, admin] = await Promise.all([
    signIn(base, "stockist@city.com"),
    signIn(base, "mfr@apex.com"),
    signIn(base, "admin@pharmalink.com"),
  ])
  orderId = await anyOrderId()
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
