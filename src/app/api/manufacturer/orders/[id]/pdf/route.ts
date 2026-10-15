import PDFDocument from "pdfkit"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/access"
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("MANUFACTURER"); if ("error" in auth) return auth.error
  const { id } = await params; const order = await prisma.order.findFirst({ where: { id, sellerId: auth.session.user.organizationId! }, include: { seller: true, buyer: true, items: { include: { product: true } } } })
  if (!order) return new Response("Order not found", { status: 404 })
  const chunks: Buffer[] = []; const document = new PDFDocument({ margin: 48 }); document.on("data", (chunk: Buffer) => chunks.push(chunk)); const done = new Promise<Buffer>((resolve) => document.on("end", () => resolve(Buffer.concat(chunks))))
  document.fontSize(20).text("PharmaLink Tax Invoice"); document.moveDown().fontSize(10).text(`Invoice: ${order.invoiceNumber ?? "Pending confirmation"}`).text(`PO: ${order.poNumber ?? order.id}`).text(`Manufacturer: ${order.seller.name}`).text(`Stockist: ${order.buyer.name}`).moveDown()
  order.items.forEach((item) => document.text(`${item.product.name} · Qty ${item.quantity} · ₹${(item.price * item.quantity).toFixed(2)}`)); document.moveDown().text(`Subtotal: ₹${order.subtotal.toFixed(2)}`).text(`Scheme discounts: ₹${order.discount.toFixed(2)}`).text(`GST: ₹${order.gst.toFixed(2)}`).fontSize(13).text(`Total: ₹${order.total.toFixed(2)}`); document.end()
  return new Response(new Uint8Array(await done), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename=invoice-${order.id}.pdf` } })
}
