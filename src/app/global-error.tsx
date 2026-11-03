"use client"

import { useEffect } from "react"

/**
 * The last resort, for a failure in the root layout itself.
 *
 * Everything else in this app is wrapped by src/app/error.tsx, but a boundary
 * does not catch an error in the layout above it, so a root layout that throws
 * would otherwise render nothing at all. This file replaces the root layout when
 * that happens, which is why it has to supply its own html and body.
 *
 * Global error UI renders its own document and does not pick up the app's
 * stylesheet, so the handful of classes used here are written out inline. The
 * theme follows the operating system's light and dark preference, which is the
 * only signal available at this level. There is no sign-in form here on
 * purpose: the layout is what failed, and a session cannot be read from a
 * document that never got built.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "1.5rem",
          background: "oklch(0.975 0.012 170)",
          color: "oklch(0.22 0.035 220)",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <div style={{ maxWidth: "28rem", textAlign: "center" }}>
          <p
            style={{
              margin: 0,
              fontSize: "0.6875rem",
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "oklch(0.55 0.09 170)",
            }}
          >
            Something went wrong
          </p>
          <h1 style={{ margin: "0.5rem 0 0", fontSize: "1.5rem", fontWeight: 600 }}>
            PharmaLink could not start
          </h1>
          <p style={{ margin: "0.75rem 0 0", fontSize: "0.875rem", lineHeight: 1.5, opacity: 0.75 }}>
            Something failed while preparing the page, so none of the app could be shown. Trying again
            may clear it.
          </p>
          {error.digest ? (
            <p style={{ margin: "1rem 0 0", fontSize: "0.75rem", opacity: 0.6 }}>
              Reference <code>{error.digest}</code>
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => retry()}
            style={{
              marginTop: "1.5rem",
              minHeight: "2.75rem",
              padding: "0 1.25rem",
              borderRadius: "0.5rem",
              border: "1px solid oklch(0.22 0.035 220 / 0.2)",
              background: "oklch(0.22 0.035 220)",
              color: "oklch(0.98 0 0)",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
