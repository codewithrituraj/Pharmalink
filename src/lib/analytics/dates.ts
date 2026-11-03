const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const

const MS_PER_DAY = 86_400_000

export function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

export function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

export function monthName(monthIndex: number) {
  return MONTH_NAMES[((monthIndex % 12) + 12) % 12]
}

export function monthLabel(date: Date) {
  return `${monthName(date.getMonth())} ${String(date.getFullYear()).slice(2)}`
}

export function daysBetween(from: Date, to: Date) {
  return Math.ceil((to.getTime() - from.getTime()) / MS_PER_DAY)
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * MS_PER_DAY)
}

export function toDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function formatCurrency(value: number, fractionDigits = 0) {
  return `₹${value.toLocaleString("en-IN", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`
}

export function formatRelativeDays(days: number) {
  if (days <= 0) return "today"
  if (days === 1) return "tomorrow"
  if (days < 30) return `in ${days} days`
  const months = Math.round(days / 30)
  return months <= 1 ? "in about a month" : `in about ${months} months`
}
