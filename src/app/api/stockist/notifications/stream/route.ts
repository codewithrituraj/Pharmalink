import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const POLL_INTERVAL_MS = 2500
const MAX_TRACKED_IDS = 400

/**
 * Server-Sent Events stream for live notification delivery.
 *
 * The stream watches the database for notifications belonging to the signed-in
 * organization and pushes each new one to the browser. It re-reads from SQLite
 * rather than keeping in-memory state, so it stays correct no matter which
 * process (or route bundle) created the notification.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "STOCKIST" || !session.user.organizationId) {
    return new Response("Unauthorized", { status: 401 })
  }

  const organizationId = session.user.organizationId
  const encoder = new TextEncoder()
  let timer: ReturnType<typeof setTimeout> | undefined
  let closed = false
  const seen = new Set<string>()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          )
        } catch {
          closed = true
        }
      }

      const close = () => {
        if (closed) return
        closed = true
        if (timer) clearTimeout(timer)
        try {
          controller.close()
        } catch {
          // The client already went away.
        }
      }

      req.signal.addEventListener("abort", close)
      send("retry", { interval: 3000 })

      const tick = async () => {
        if (closed) return
        try {
          // Prime the seen-set with what already exists so only new alerts stream.
          const latest = await prisma.notification.findMany({
            where: { organizationId },
            orderBy: { createdAt: "desc" },
            take: 50,
            select: { id: true },
          })
          if (seen.size === 0) {
            latest.forEach((notification) => seen.add(notification.id))
            const unread = await prisma.notification.count({
              where: { organizationId, readAt: null },
            })
            send("ready", { unread, connectedAt: new Date().toISOString() })
          }

          const fresh = await prisma.notification.findMany({
            where: { organizationId, id: { notIn: [...seen] } },
            orderBy: { createdAt: "asc" },
            take: 20,
          })

          for (const notification of fresh) {
            seen.add(notification.id)
            send("notification", {
              id: notification.id,
              type: notification.type,
              title: notification.title,
              message: notification.message,
              severity: notification.severity,
              link: notification.link,
              readAt: notification.readAt ? notification.readAt.toISOString() : null,
              createdAt: notification.createdAt.toISOString(),
            })
          }

          if (seen.size > MAX_TRACKED_IDS) {
            for (const id of [...seen].slice(0, seen.size - MAX_TRACKED_IDS)) {
              seen.delete(id)
            }
          }

          const unread = await prisma.notification.count({
            where: { organizationId, readAt: null },
          })
          send("unread", { unread, at: new Date().toISOString() })
        } catch {
          send("error", { message: "Notification stream hiccup, retrying" })
        }

        if (!closed) timer = setTimeout(tick, POLL_INTERVAL_MS)
      }

      timer = setTimeout(tick, 0)
    },
    cancel() {
      closed = true
      if (timer) clearTimeout(timer)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
