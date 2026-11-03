"use client"

import { useEffect } from "react"
import { RefreshCw, TriangleAlert } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

/**
 * The error boundary for a page that threw while rendering.
 *
 * This catches the failure nobody planned for, which is the point: a server
 * component that reads something the database no longer has, a value that was
 * undefined where a shape was assumed. Without a boundary that is a blank page
 * with an error in the console, and a stockist staring at it with no idea
 * whether to retry or to leave.
 *
 * In production the message a server component throws is deliberately
 * replaced, because the original may hold details about the database. The digest
 * is the only thing that ties this screen to the server log, so it is shown
 * rather than swallowed. The full message is only rendered in development.
 */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    // Server-side the same error is already logged with the digest, so this is
    // for the browser console rather than a second report.
    console.error(error)
  }, [error])

  return (
    <div className="grid min-h-[60vh] place-items-center px-4">
      <Card className="surface-card w-full max-w-lg border-0">
        <CardContent className="space-y-5 py-12 text-center">
          <div className="flex justify-center">
            <span className="grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
              <TriangleAlert className="size-6" />
            </span>
          </div>
          <div className="space-y-2">
            <p className="eyebrow">Something went wrong</p>
            <h1 className="text-2xl font-semibold tracking-tight">This page could not load</h1>
            <p className="text-sm text-muted-foreground">
              The failure is on our side, not yours. Trying again often clears it, and nothing you
              did caused it.
            </p>
          </div>
          {process.env.NODE_ENV === "development" && error.message ? (
            <p className="rounded-lg bg-muted px-3 py-2 text-left text-xs text-muted-foreground">
              {error.message}
            </p>
          ) : null}
          {error.digest ? (
            <p className="text-xs text-muted-foreground">
              Reference <code className="font-mono">{error.digest}</code>
            </p>
          ) : null}
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={() => retry()} className="min-h-11">
              <RefreshCw className="size-4" /> Try again
            </Button>
            <Button variant="outline" onClick={() => router.push("/")} className="min-h-11">
              Back to sign in
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
