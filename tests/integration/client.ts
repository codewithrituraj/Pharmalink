/**
 * HTTP helpers for the integration tests.
 *
 * These deliberately go through the real endpoints, including the NextAuth
 * CSRF handshake, so that a test session is indistinguishable from a browser's.
 * A hand-built cookie jar or a skipped CSRF step would let these checks pass
 * against a server that a real user could not log in to.
 */

/** A logged-in session, held as the cookie header the server handed back. */
export type Session = { cookie: string; email: string }

export type ApiResponse<T = unknown> = { status: number; body: T }

/** The shape every route uses to report a refusal. */
export type ErrorBody = { error: string }

/** The order placement response: the priced order and the line it was for. */
export type PlacedOrder = {
  success?: boolean
  error?: string
  order: { id: string }
  subtotal: number
  discount: number
  gst: number
  total: number
}

/** One product as the search endpoint returns it. */
export type CatalogueProduct = {
  id: string
  name: string
  manufacturerId: string
  minOrderQty: number
  batches: { id: string; expiryDate: string }[]
}

export async function signIn(base: string, email: string, password = "password123") {
  const csrfRes = await fetch(`${base}/api/auth/csrf`)
  if (!csrfRes.ok) {
    throw new Error(`CSRF endpoint returned ${csrfRes.status} for ${email}`)
  }
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string }
  const csrfCookie = csrfRes.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ")

  const res = await fetch(`${base}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: csrfCookie },
    body: new URLSearchParams({ csrfToken, email, password, json: "true" }),
  })

  const sessionCookie = res.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ")

  if (!sessionCookie.includes("next-auth.session-token")) {
    throw new Error(`Sign in for ${email} did not yield a session token`)
  }
  return { cookie: sessionCookie, email } satisfies Session
}

export async function api<T = unknown>(
  base: string,
  session: Session | null,
  pathname: string,
  init: { method?: string; body?: unknown } = {},
): Promise<ApiResponse<T>> {
  const res = await fetch(`${base}${pathname}`, {
    method: init.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(session ? { cookie: session.cookie } : {}),
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  })

  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    body = null
  }
  return { status: res.status, body: body as T }
}
