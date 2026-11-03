export type BarListItem = {
  key: string
  label: string
  value: number
  detail?: string
}

export type BarListProps = {
  items: BarListItem[]
  valueFormatter: (value: number) => string
  emptyMessage?: string
  /** Colour class for the fill, defaults to the primary colour. */
  barClassName?: string
  maxItems?: number
}

/**
 * Horizontal share list used for spend by manufacturer and by category. Each
 * row wraps rather than truncating, so it stays readable from 390px upwards.
 */
export function BarList({
  items,
  valueFormatter,
  emptyMessage = "Nothing recorded yet.",
  barClassName = "bg-primary",
  maxItems = 8,
}: BarListProps) {
  const visible = items.slice(0, maxItems)
  const max = Math.max(...visible.map((item) => item.value), 1)

  if (visible.length === 0) {
    return <p className="rounded-xl bg-muted/60 p-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
  }

  return (
    <ul className="space-y-3">
      {visible.map((item) => (
        <li key={item.key} className="space-y-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <span className="text-sm font-medium">{item.label}</span>
            <span className="number text-sm font-semibold">{valueFormatter(item.value)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${barClassName}`}
                style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }}
              />
            </div>
            {item.detail ? (
              <span className="shrink-0 text-xs text-muted-foreground">{item.detail}</span>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  )
}
