const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
})

/** Currency for the UI. Server and client components must format identically. */
export function formatCurrency(value: number) {
  return inr.format(Number.isFinite(value) ? value : 0)
}

/** Compact currency for chart axes, e.g. ₹1.2L or ₹45k. */
export function formatCompactCurrency(value: number) {
  const safe = Number.isFinite(value) ? value : 0
  const absolute = Math.abs(safe)
  if (absolute >= 100_000) return `₹${(safe / 100_000).toFixed(1)}L`
  if (absolute >= 1_000) return `₹${Math.round(safe / 1000)}k`
  return `₹${Math.round(safe)}`
}

/** Human-friendly "3 min ago" style stamp, safe to call from either side. */
export function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diff / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
}
