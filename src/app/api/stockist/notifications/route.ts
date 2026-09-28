import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const querySchema = z.object({
  type: z.string().trim().optional(),
  unreadOnly: z.enum(["true", "false"]).optional(),
  take: z.coerce.number().int().min(1).max(200).default(60),
})

const patchSchema = z.object({
  id: z.string().min(1).optional(),
  all: z.boolean().optional(),
})

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const organizationId = session.user.organizationId
  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  )
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid filters" }, { status: 400 })
  }
  const { type, unreadOnly, take } = parsed.data

  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({
      where: {
        organizationId,
        ...(type ? { type } : {}),
        ...(unreadOnly === "true" ? { readAt: null } : {}),
      },
      orderBy: [{ createdAt: "desc" }],
      take,
    }),
    prisma.notification.count({ where: { organizationId, readAt: null } }),
  ])

  return NextResponse.json({
    notifications: notifications.map((notification) => ({
      ...notification,
      createdAt: notification.createdAt.toISOString(),
      readAt: notification.readAt ? notification.readAt.toISOString() : null,
    })),
    unread,
    serverTime: new Date().toISOString(),
  })
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const organizationId = session.user.organizationId
  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success || (!parsed.data.id && !parsed.data.all)) {
    return NextResponse.json({ error: "Invalid notification action" }, { status: 400 })
  }

  // Ownership is enforced by scoping the update to the signed-in organization.
  const readAt = new Date()
  const result = await prisma.notification.updateMany({
    where: {
      organizationId,
      readAt: null,
      ...(parsed.data.id ? { id: parsed.data.id } : {}),
    },
    data: { readAt },
  })

  if (parsed.data.id && result.count === 0) {
    const exists = await prisma.notification.findFirst({
      where: { id: parsed.data.id, organizationId },
      select: { id: true, readAt: true },
    })
    if (!exists) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 })
    }
  }

  const unread = await prisma.notification.count({
    where: { organizationId, readAt: null },
  })

  return NextResponse.json({ success: true, updated: result.count, unread })
}
