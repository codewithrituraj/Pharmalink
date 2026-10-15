/**
 * Reading one order on behalf of the stockist who placed it.
 *
 * The order detail route and the order detail page both need this, and they
 * must agree: a page that asked for the order any other way could show a
 * document the route would have refused. The ownership filter lives here so
 * there is one place where "is this the buyer's order" is decided, and so both
 * callers scope by the buying organization rather than by id alone.
 *
 * This sits apart from src/lib/orders.ts, which is deliberately free of database
 * access and holds only the rules worth testing on their own.
 */
import { prisma } from "@/lib/prisma"

/**
 * The order as the detail page and the detail route both present it.
 *
 * Dates are kept as Date objects for the server-rendered page and serialized to
 * ISO strings for the JSON route, so both consumers see the same fields.
 */
export const orderDetailInclude = {
  seller: true,
  buyer: true,
  items: {
    include: {
      product: true,
      allocations: {
        include: {
          batch: true,
        },
      },
    },
  },
  audits: { orderBy: { createdAt: "asc" as const } },
} as const

/**
 * Loads an order only if the given organization placed it, otherwise null.
 *
 * Returning null rather than throwing lets the route answer 404 and the page
 * render its not-found state, which are different answers to the same question.
 */
export async function loadOrderForBuyer(buyerId: string, orderId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, buyerId },
    include: orderDetailInclude,
  })
}
