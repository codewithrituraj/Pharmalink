"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Bell, CheckCheck, Radio } from "lucide-react"

import { useNotifications } from "@/hooks/use-notifications"
import { NotificationRow } from "@/components/notifications/notification-row"
import { Button } from "@/components/ui/button"

export function NotificationBell() {
  const { notifications, unread, status, markRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative grid size-11 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
        aria-label={unread > 0 ? `Open notifications, ${unread} unread` : "Open notifications"}
        aria-expanded={open}
      >
        <Bell className="size-4" />
        {unread > 0 ? (
          <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-rose-500 text-[0.6rem] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
        {status === "live" ? (
          <span className="absolute bottom-1 right-1 size-1.5 rounded-full bg-emerald-500" aria-hidden />
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">Supply alerts</p>
            <div className="flex items-center gap-1.5">
              <span className="flex items-center gap-1 text-[0.65rem] text-muted-foreground">
                <Radio className="size-3" />
                {status === "live" ? "Live" : status === "polling" ? "Polling" : "…"}
              </span>
              <Button size="xs" variant="ghost" onClick={markAllRead} disabled={unread === 0}>
                <CheckCheck className="size-3" /> Read all
              </Button>
            </div>
          </div>

          <ul className="max-h-96 divide-y divide-border overflow-y-auto">
            {notifications.slice(0, 8).map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                onRead={markRead}
                compact
              />
            ))}
            {notifications.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                You are all caught up. New alerts arrive here live.
              </li>
            ) : null}
          </ul>

          <div className="border-t border-border p-2">
            <Link
              href="/stockist/notifications"
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center justify-center rounded-lg text-sm font-semibold text-primary hover:bg-muted"
            >
              Open notification centre
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  )
}
