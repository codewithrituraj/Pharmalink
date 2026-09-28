"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export { relativeTime } from "@/lib/format"

export type NotificationSeverity = "INFO" | "WARNING" | "CRITICAL"
export type StockistNotification = {
  id: string
  type: string
  title: string
  message: string
  severity: NotificationSeverity
  link: string | null
  readAt: string | null
  createdAt: string
}

const POLL_INTERVAL_MS = 60_000

/**
 * Live notifications for the signed-in stockist.
 *
 * Subscribes to the server-sent event stream and falls back to polling if the
 * stream cannot be established, so alerts still arrive on restrictive proxies.
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState<StockistNotification[]>([])
  const [unread, setUnread] = useState(0)
  const [status, setStatus] = useState<"connecting" | "live" | "polling">("connecting")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [serverTime, setServerTime] = useState("")
  const fallbackTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(
    () =>
      fetch("/api/stockist/notifications?take=60", { cache: "no-store" })
        .then((response) =>
          response
            .json()
            .catch(() => null)
            .then((payload) => {
              if (!response.ok) {
                throw new Error(payload?.error ?? "Could not load notifications")
              }
              return payload as {
              notifications: StockistNotification[]
              unread: number
              serverTime: string
            }
            }),
        )
        .then((payload) => {
          setNotifications(payload.notifications)
          setUnread(payload.unread)
          setServerTime(payload.serverTime)
          setError(null)
        })
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause.message : "Could not load notifications")
        })
        .finally(() => setLoading(false)),
    [],
  )

  const merge = useCallback((incoming: StockistNotification) => {
    setNotifications((current) => {
      const withoutDuplicate = current.filter((item) => item.id !== incoming.id)
      return [incoming, ...withoutDuplicate].slice(0, 60)
    })
  }, [])

  useEffect(() => {
    let source: EventSource | null = null
    let closed = false

    const startPolling = () => {
      if (closed || fallbackTimer.current) return
      setStatus("polling")
      fallbackTimer.current = setInterval(load, POLL_INTERVAL_MS)
    }

    void load()

    try {
      source = new EventSource("/api/stockist/notifications/stream")
      source.addEventListener("ready", (event) => {
        if (closed) return
        setStatus("live")
        const payload = JSON.parse((event as MessageEvent).data) as { unread: number }
        setUnread(payload.unread)
      })
      source.addEventListener("notification", (event) => {
        if (closed) return
        const payload = JSON.parse((event as MessageEvent).data) as StockistNotification
        merge(payload)
        setUnread((current) => (payload.readAt ? current : current + 1))
      })
      source.addEventListener("unread", (event) => {
        if (closed) return
        const payload = JSON.parse((event as MessageEvent).data) as { unread: number }
        setUnread(payload.unread)
      })
      source.onerror = () => {
        if (closed) return
        setStatus("polling")
        startPolling()
      }
    } catch {
      startPolling()
    }

    return () => {
      closed = true
      source?.close()
      if (fallbackTimer.current) {
        clearInterval(fallbackTimer.current)
        fallbackTimer.current = null
      }
    }
  }, [load, merge])

  const markRead = useCallback(
    async (id: string) => {
      setNotifications((current) =>
        current.map((item) => (item.id === id ? { ...item, readAt: new Date().toISOString() } : item)),
      )
      setUnread((current) => Math.max(0, current - 1))
      try {
        const response = await fetch("/api/stockist/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload?.error ?? "Could not update notification")
        setUnread(payload.unread)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not update notification")
        load()
      }
    },
    [load],
  )

  const markAllRead = useCallback(async () => {
    const previous = notifications
    const stamp = new Date().toISOString()
    setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? stamp })))
    setUnread(0)
    try {
      const response = await fetch("/api/stockist/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error ?? "Could not update notifications")
      setUnread(payload.unread)
    } catch (cause) {
      setNotifications(previous)
      setError(cause instanceof Error ? cause.message : "Could not update notifications")
    }
  }, [notifications])

  return {
    notifications,
    unread,
    status,
    error,
    loading,
    serverTime,
    markRead,
    markAllRead,
    refresh: load,
  }
}
