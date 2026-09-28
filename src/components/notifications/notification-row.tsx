"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import {
  BellRing,
  CalendarClock,
  ClipboardCheck,
  PackageCheck,
  Radio,
  Sparkles,
  Truck,
  TriangleAlert,
} from "lucide-react"

import { cn } from "@/lib/utils"
import type { StockistNotification } from "@/hooks/use-notifications"
import { relativeTime } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/empty-state"

const ICONS: Record<string, (className: string) => ReactNode> = {
  EXPIRY_WARNING: (className) => <CalendarClock className={className} />,
  EXPIRY_CRITICAL: (className) => <TriangleAlert className={className} />,
  LOW_STOCK: (className) => <PackageCheck className={className} />,
  STOCKOUT_RISK: (className) => <TriangleAlert className={className} />,
  SCHEME: (className) => <Sparkles className={className} />,
  ORDER_STATUS: (className) => <Truck className={className} />,
  ORDER_PLACED: (className) => <ClipboardCheck className={className} />,
  ACCESS_REQUEST: (className) => <ClipboardCheck className={className} />,
  ACCESS_DECISION: (className) => <ClipboardCheck className={className} />,
  STOCK_ALERT: (className) => <BellRing className={className} />,
}

export const NOTIFICATION_TYPES: { value: string; label: string }[] = [
  { value: "all", label: "All alerts" },
  { value: "EXPIRY_WARNING", label: "Expiry (30–60 days)" },
  { value: "EXPIRY_CRITICAL", label: "Expiry (≤ 30 days)" },
  { value: "LOW_STOCK", label: "Low stock" },
  { value: "STOCKOUT_RISK", label: "Stock-out risk" },
  { value: "SCHEME", label: "Scheme" },
  { value: "ORDER_STATUS", label: "Orders" },
]

export function notificationIcon(type: string, className = "size-4") {
  return (ICONS[type] ?? ICONS.STOCK_ALERT)(className)
}

export function severityVariant(severity: StockistNotification["severity"]) {
  if (severity === "CRITICAL") return "destructive" as const
  if (severity === "WARNING") return "warning" as const
  return "outline" as const
}

export function NotificationRow({
  notification,
  onRead,
  compact = false,
}: {
  notification: StockistNotification
  onRead?: (id: string) => void
  compact?: boolean
}) {
  const icon = notificationIcon(notification.type, "size-4")
  const unread = !notification.readAt

  const body = (
    <>
      <div
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-xl",
          notification.severity === "CRITICAL"
            ? "bg-destructive/10 text-destructive"
            : notification.severity === "WARNING"
              ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
              : "bg-secondary text-primary",
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className={cn("text-sm", unread ? "font-semibold" : "font-medium")}>{notification.title}</p>
          {unread ? <span className="size-1.5 rounded-full bg-primary" aria-label="Unread" /> : null}
        </div>
        <p className={cn("mt-0.5 text-sm leading-5 text-muted-foreground", compact && "line-clamp-2")}>
          {notification.message}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{relativeTime(notification.createdAt)}</p>
      </div>
    </>
  )

  return (
    <li
      className={cn(
        "flex items-start gap-3 px-5 transition-colors",
        unread ? "bg-primary/[0.04]" : "bg-card",
        "py-4",
      )}
    >
      {notification.link ? (
        <Link
          href={notification.link}
          onClick={() => onRead?.(notification.id)}
          className="flex flex-1 items-start gap-3 focus-visible:outline-none"
        >
          {body}
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => onRead?.(notification.id)}
          className="flex flex-1 items-start gap-3 text-left"
        >
          {body}
        </button>
      )}
      {unread && onRead ? (
        <Button size="sm" variant="ghost" onClick={() => onRead(notification.id)}>
          Mark read
        </Button>
      ) : null}
    </li>
  )
}

export function NotificationEmptyState() {
  return (
    <EmptyState
      icon={Radio}
      title="You're all caught up"
      description="Expiry warnings, low-stock alerts, scheme opportunities and order updates will appear here the moment they happen."
    />
  )
}
