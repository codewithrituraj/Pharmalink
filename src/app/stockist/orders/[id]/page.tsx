import { getServerSession } from "next-auth/next"
import Link from "next/link"

import { authOptions } from "@/lib/auth"
import { loadOrderForBuyer } from "@/lib/order-detail"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

import { OrderDetail, type OrderDetail as OrderDetailData } from "./order-detail"

/**
 * The order detail page, reading the order on the server.
 *
 * An order id can be anything, and most of what anyone will type is not a real
 * one. The page checks the order against the buying organization here, for the
 * same reason the route does, and renders the not-found card when there is
 * nothing to show.
 *
 * It answers 200 either way. The stockist layout already turns away anyone who
 * is not signed in as a stockist, so a 404 here would only be a status code for
 * a mistyped or stale link, behind a page that renders perfectly well. The
 * missing-order case is real but expected, and a link to an order that was
 * cancelled still deserves to open.
 */
export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  // The layout guards this already. If it ever stops doing so, the page must not
  // fall through to a query with no organization to scope it by.
  if (!session?.user.organizationId) return null

  const order = await loadOrderForBuyer(session.user.organizationId, id)

  if (!order) {
    return (
      <div className="space-y-6">
        <Card className="surface-card border-0">
          <CardContent className="space-y-4 py-16 text-center">
            <p className="text-lg font-medium">Order not found</p>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              This order does not exist, or it belongs to another organization.
            </p>
            <Link
              href="/stockist/orders"
              className={`${buttonVariants({ variant: "outline" })} min-h-11`}
            >
              Back to orders
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const detail: OrderDetailData = {
    ...order,
    createdAt: order.createdAt.toISOString(),
    audits: order.audits.map((audit) => ({
      id: audit.id,
      status: audit.status,
      note: audit.note,
      createdAt: audit.createdAt.toISOString(),
    })),
  }

  return <OrderDetail initialOrder={detail} />
}
