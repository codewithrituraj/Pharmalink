export type LedgerOrderInput = {
  id: string
  poNumber: string | null
  invoiceNumber: string | null
  invoiceCreatedAt?: Date | string | null
  createdAt: Date | string
  total: number
  seller?: { name?: string | null } | null
}

export type LedgerInvoice = {
  id: string
  poNumber: string | null
  invoiceNumber: string
  invoiceDate: string
  daysOutstanding: number
  manufacturer: string
  total: number
}

export type OutstandingLedger = {
  asOf: string
  totalOutstanding: number
  invoiceCount: number
  aging: {
    days0To30: number
    days31To60: number
    days61To90: number
    over90Days: number
  }
  invoices: LedgerInvoice[]
}

export function buildOutstandingLedger(orders: LedgerOrderInput[], asOf = new Date()): OutstandingLedger {
  const aging = { days0To30: 0, days31To60: 0, days61To90: 0, over90Days: 0 }
  const invoices = orders.map((order) => {
    const invoiceDate = new Date(order.invoiceCreatedAt ?? order.createdAt)
    const daysOutstanding = Math.max(0, Math.floor((asOf.getTime() - invoiceDate.getTime()) / 86_400_000))
    const total = Number(order.total ?? 0)

    if (daysOutstanding <= 30) aging.days0To30 += total
    else if (daysOutstanding <= 60) aging.days31To60 += total
    else if (daysOutstanding <= 90) aging.days61To90 += total
    else aging.over90Days += total

    return {
      id: order.id,
      poNumber: order.poNumber,
      invoiceNumber: order.invoiceNumber ?? "Invoice pending",
      invoiceDate: invoiceDate.toISOString(),
      daysOutstanding,
      manufacturer: order.seller?.name ?? "Manufacturer",
      total,
    }
  })

  const totalOutstanding = invoices.reduce((sum, invoice) => sum + invoice.total, 0)
  return {
    asOf: asOf.toISOString(),
    totalOutstanding: Math.round(totalOutstanding * 100) / 100,
    invoiceCount: invoices.length,
    aging: Object.fromEntries(
      Object.entries(aging).map(([key, amount]) => [key, Math.round(amount * 100) / 100]),
    ) as OutstandingLedger["aging"],
    invoices,
  }
}