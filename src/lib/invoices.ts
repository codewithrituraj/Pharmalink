export type InvoiceSummaryInput = {
  id: string
  poNumber: string | null
  invoiceNumber: string | null
  invoiceCreatedAt?: Date | string | null
  status: string
  total: number
  subtotal: number
  discount: number
  gst: number
  seller?: { name?: string | null } | null
  buyer?: { name?: string | null } | null
  items?: Array<{
    quantity?: number | null
    price?: number | null
    product?: { name?: string | null; hsnCode?: string | null } | null
  }> | null
}

export type InvoiceSummary = {
  id: string
  poNumber: string | null
  invoiceNumber: string | null
  invoiceDate: string | null
  status: string
  total: number
  subtotal: number
  discount: number
  gst: number
  manufacturer: string
  stockist: string
  items: Array<{
    quantity: number
    price: number
    product: { name: string; hsnCode: string | null }
  }>
}

export function buildInvoiceSummary(order: InvoiceSummaryInput): InvoiceSummary {
  const date = order.invoiceCreatedAt ? new Date(order.invoiceCreatedAt) : null
  return {
    id: order.id,
    poNumber: order.poNumber,
    invoiceNumber: order.invoiceNumber,
    invoiceDate: date && !Number.isNaN(date.getTime()) ? date.toISOString() : null,
    status: order.status,
    total: Number(order.total ?? 0),
    subtotal: Number(order.subtotal ?? 0),
    discount: Number(order.discount ?? 0),
    gst: Number(order.gst ?? 0),
    manufacturer: order.seller?.name ?? "Manufacturer",
    stockist: order.buyer?.name ?? "Stockist",
    items: (order.items ?? []).map((item) => ({
      quantity: Number(item.quantity ?? 0),
      price: Number(item.price ?? 0),
      product: {
        name: item.product?.name ?? "Medicine",
        hsnCode: item.product?.hsnCode ?? null,
      },
    })),
  }
}
