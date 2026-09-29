import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

/**
 * The 404 page.
 *
 * Next serves this for any URL that matches no route, so someone who mistypes a
 * path, follows a stale link, or guesses at a stockist order id gets something
 * that looks like this app rather than Next's default page.
 *
 * It deliberately does not know which role is signed in. This file renders
 * outside the layouts, so it cannot ask for a session without a layout to put it
 * in, and a 404 that behaved differently per role would be a page that renders
 * in two completely different shapes. Everyone gets the same answer and the same
 * way back.
 *
 * The order detail page does not come here. A stockist who opens a cancelled or
 * mistyped order id gets an inline explanation and a 200, because that order
 * exists in their history and the page is still the right place to be. This is
 * for URLs that are not part of the app at all.
 */
export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6">
      <Card className="surface-card w-full max-w-md border-0">
        <CardContent className="space-y-5 py-14 text-center">
          <div className="space-y-2">
            <p className="eyebrow">Page not found</p>
            <h1 className="text-3xl font-semibold tracking-tight">Nothing at this address</h1>
            <p className="text-sm text-muted-foreground">
              The page you asked for is not part of PharmaLink. It may have moved, or the link may
              have been mistyped.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/" className={`${buttonVariants()} min-h-11`}>
              Go to sign in
            </Link>
            <Link
              href="/login"
              className={`${buttonVariants({ variant: "outline" })} min-h-11`}
            >
              Sign in
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            Looking for an order? <Link href="/stockist/orders" className="text-primary underline underline-offset-4">Open your orders</Link>
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
