import type { Prisma, PrismaClient } from "@prisma/client"

type DbClient = Prisma.TransactionClient | PrismaClient

export const NOTIFICATION_TYPES = [
  "ORDER_PLACED",
  "ORDER_STATUS",
  "ACCESS_REQUEST",
  "ACCESS_DECISION",
  "LOW_STOCK",
  "EXPIRY",
  "SCHEME",
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export type NotificationSeverity = "INFO" | "WARNING" | "CRITICAL"

export type NotifyInput = {
  organizationId: string
  type: NotificationType
  title: string
  message: string
  severity?: NotificationSeverity
  link?: string
  /**
   * Stable key used to avoid repeating the same alert. Alerts that describe a
   * state (an expiring batch, a low stock band) should always pass one.
   */
  dedupeKey?: string
}

export type NotifyResult = {
  created: boolean
  reason: "CREATED" | "DUPLICATE"
}

const SEVERITY_BY_TYPE: Record<NotificationType, NotificationSeverity> = {
  ORDER_PLACED: "INFO",
  ORDER_STATUS: "INFO",
  ACCESS_REQUEST: "INFO",
  ACCESS_DECISION: "INFO",
  SCHEME: "INFO",
  LOW_STOCK: "WARNING",
  EXPIRY: "WARNING",
}

/**
 * Creates a notification for an organization. When a `dedupeKey` is supplied the
 * alert is only stored once, which lets daily jobs re-run safely without
 * spamming the notification center every night.
 */
export async function notify(db: DbClient, input: NotifyInput): Promise<NotifyResult> {
  if (input.dedupeKey) {
    const existing = await db.notification.findUnique({
      where: {
        organizationId_dedupeKey: {
          organizationId: input.organizationId,
          dedupeKey: input.dedupeKey,
        },
      },
      select: { id: true },
    })
    if (existing) return { created: false, reason: "DUPLICATE" }
  }

  await db.notification.create({
    data: {
      organizationId: input.organizationId,
      type: input.type,
      title: input.title,
      message: input.message,
      severity: input.severity ?? SEVERITY_BY_TYPE[input.type],
      ...(input.link ? { link: input.link } : {}),
      ...(input.dedupeKey ? { dedupeKey: input.dedupeKey } : {}),
    },
  })

  return { created: true, reason: "CREATED" }
}

export type NotifyManyResult = { created: number; skipped: number }

export async function notifyMany(
  db: DbClient,
  inputs: NotifyInput[],
): Promise<NotifyManyResult> {
  let created = 0
  let skipped = 0
  for (const input of inputs) {
    const result = await notify(db, input)
    if (result.created) created += 1
    else skipped += 1
  }
  return { created, skipped }
}

export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  ORDER_PLACED: "New order",
  ORDER_STATUS: "Order update",
  ACCESS_REQUEST: "Access request",
  ACCESS_DECISION: "Access decision",
  LOW_STOCK: "Low stock",
  EXPIRY: "Expiry alert",
  SCHEME: "New scheme",
}

export const NOTIFICATION_TYPE_GROUP: Record<NotificationType, string> = {
  ORDER_PLACED: "orders",
  ORDER_STATUS: "orders",
  ACCESS_REQUEST: "access",
  ACCESS_DECISION: "access",
  LOW_STOCK: "supply",
  EXPIRY: "supply",
  SCHEME: "supply",
}
