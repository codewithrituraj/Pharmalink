import { prisma } from "@/lib/prisma"
import { csv, requireRole } from "@/lib/access"

export async function GET(req: Request) {
  const auth = await requireRole("MANUFACTURER"); if ("error" in auth) return auth.error
  const type = new URL(req.url).searchParams.get("type") ?? "orders"
  const sellerId = auth.session.user.organizationId!
  if (type === "invoices") {
    const records = await prisma.order.findMany({ where: { sellerId, invoiceNumber: { not: null } }, include: { buyer: true }, orderBy: { createdAt: "desc" } })
    return new Response(csv([["Invoice", "Date", "Stockist", "Subtotal", "Discount", "GST", "Total"], ...records.map((o) => [o.invoiceNumber, o.createdAt.toISOString(), o.buyer.name, o.subtotal, o.discount, o.gst, o.total])]), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=pharmalink-invoices.csv" } })
  }
  const records = await prisma.order.findMany({ where: { sellerId }, include: { buyer: true, items: { include: { product: true } } }, orderBy: { createdAt: "desc" } })
  if (type === "sales") return new Response(csv([["Order", "Date", "Category", "Product", "Quantity", "Revenue"], ...records.flatMap((o) => o.items.map((i) => [o.poNumber ?? o.id, o.createdAt.toISOString(), i.product.category, i.product.name, i.quantity, i.price * i.quantity]))]), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=pharmalink-sales.csv" } })
  return new Response(csv([["PO", "Date", "Stockist", "Status", "Invoice", "Total"], ...records.map((o) => [o.poNumber ?? o.id, o.createdAt.toISOString(), o.buyer.name, o.status, o.invoiceNumber, o.total])]), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=pharmalink-orders.csv" } })
}
