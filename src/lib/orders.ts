/**
 * Pure business rules for the purchase order lifecycle.
 *
 * These live apart from the route handlers on purpose: the allocation,
 * pricing and status rules decide what stock moves and what a customer is
 * charged, so they are covered by tests rather than only by the routes that
 * happen to call them. Nothing here touches the database.
 */

export type FefoBatch = {
  id: string
  quantity: number
  expiryDate: Date | string
}

export type Allocation = { batchId: string; quantity: number }

function expiryTime(value: Date | string) {
  return value instanceof Date ? value.getTime() : new Date(value).getTime()
}

/**
 * Splits an order quantity across batches, taking from the batch that expires
 * soonest first. Batches are sorted here rather than relying on the query
 * that fetched them, so the rule holds wherever the list came from.
 *
 * The caller receives the shortfall instead of an exception so it can report
 * which product is short, and so no stock is decremented before the whole
 * request is known to be satisfiable.
 */
export function allocateFefo(
  batches: FefoBatch[],
  requestedQuantity: number,
): { allocations: Allocation[]; shortfall: number } {
  const ordered = [...batches].sort(
    (a, b) => expiryTime(a.expiryDate) - expiryTime(b.expiryDate),
  )
  const allocations: Allocation[] = []
  let remaining = Math.max(0, Math.floor(requestedQuantity))

  for (const batch of ordered) {
    if (remaining <= 0) break
    if (batch.quantity <= 0) continue
    const take = Math.min(batch.quantity, remaining)
    allocations.push({ batchId: batch.id, quantity: take })
    remaining -= take
  }

  return { allocations, shortfall: remaining }
}

/** Units a cancellation must hand back: exactly what was reserved. */
export function totalAllocated(allocations: Allocation[]) {
  return allocations.reduce((sum, allocation) => sum + allocation.quantity, 0)
}

export type SchemeInput = {
  name?: string
  type?: string
  minQuantity: number
  discountPercent?: number
  freeQuantity?: number
}

export type PricedLineInput = {
  quantity: number
  unitPrice: number
  gstPercent: number
  schemes: SchemeInput[]
}

export type PricedLine = {
  lineTotal: number
  discount: number
  freeQuantity: number
  taxable: number
  gst: number
  total: number
  scheme: SchemeInput | null
}

export type PricedOrder = {
  lines: PricedLine[]
  subtotal: number
  discount: number
  gst: number
  total: number
}

/** Money is held to paise so repeated arithmetic cannot drift. */
function paise(value: number) {
  return Math.round(value * 100) / 100
}

/**
 * Picks the scheme a quantity qualifies for: the most demanding tier it still
 * reaches, so a larger order is never given a worse rate than a smaller one.
 * Ties are broken on the deeper discount to keep the choice deterministic.
 */
export function bestScheme(
  quantity: number,
  schemes: SchemeInput[],
): SchemeInput | null {
  const eligible = schemes.filter((scheme) => quantity >= scheme.minQuantity)
  if (eligible.length === 0) return null
  return eligible.reduce((best, scheme) => {
    const sDisc = scheme.discountPercent ?? 0
    const bDisc = best.discountPercent ?? 0
    const sFree = scheme.freeQuantity ?? 0
    const bFree = best.freeQuantity ?? 0
    if (scheme.minQuantity > best.minQuantity) return scheme
    if (scheme.minQuantity === best.minQuantity) {
      if (sDisc > bDisc || sFree > bFree) return scheme
    }
    return best
  })
}

/**
 * Prices order lines. GST is charged on the discounted value, not the gross
 * line, which is the difference between a correct and an incorrect tax amount.
 */
export function priceLines(lines: PricedLineInput[]): PricedOrder {
  let subtotal = 0
  let discount = 0
  let gst = 0

  const priced = lines.map((line) => {
    const lineTotal = paise(line.unitPrice * line.quantity)
    const scheme = bestScheme(line.quantity, line.schemes)
    const discountPercent = scheme?.discountPercent ?? 0
    const lineDiscount = discountPercent > 0 ? paise(lineTotal * (discountPercent / 100)) : 0
    const freeQuantity =
      scheme && (scheme.type === "FREE_GOODS" || (scheme.freeQuantity && scheme.freeQuantity > 0))
        ? Math.floor(line.quantity / scheme.minQuantity) * (scheme.freeQuantity ?? 0)
        : 0
    const taxable = paise(lineTotal - lineDiscount)
    const lineGst = paise(taxable * (line.gstPercent / 100))

    subtotal += lineTotal
    discount += lineDiscount
    gst += lineGst

    return {
      lineTotal,
      discount: lineDiscount,
      freeQuantity,
      taxable,
      gst: lineGst,
      total: paise(taxable + lineGst),
      scheme,
    }
  })

  return {
    lines: priced,
    subtotal: paise(subtotal),
    discount: paise(discount),
    gst: paise(gst),
    total: paise(paise(subtotal) - paise(discount) + paise(gst)),
  }
}

/** Statuses a manufacturer may move an order to. Terminal states are absent. */
export const ORDER_TRANSITIONS: Record<string, readonly string[]> = {
  PLACED: ["APPROVED", "REJECTED"],
  APPROVED: ["PACKED", "REJECTED"],
  PACKED: ["DISPATCHED"],
  DISPATCHED: ["DELIVERED"],
}

export function canTransition(from: string, to: string) {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false
}

/** Stock is released only while the order is still reversible. */
export const CANCELLABLE_STATUSES = ["PLACED", "APPROVED"] as const

export function canCancel(status: string) {
  return (CANCELLABLE_STATUSES as readonly string[]).includes(status)
}
