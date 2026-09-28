import PDFDocument from "pdfkit"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "STOCKIST" || !session.user.organizationId) return new Response("Unauthorized", { status: 401 })
  const { id } = await params
  const order = await prisma.order.findFirst({ where: { id, buyerId: session.user.organizationId }, include: { seller: true, buyer: true, items: { include: { product: true } } } })
  if (!order) return new Response("Order not found", { status: 404 })
  const chunks: Buffer[] = []
  const document = new PDFDocument({ margin: 48 })
  document.on("data", (chunk: Buffer) => chunks.push(chunk))
  const done = new Promise<Buffer>((resolve) => document.on("end", () => resolve(Buffer.concat(chunks))))
  const invoice = new URL(req.url).searchParams.get("type") === "invoice"
  document.fontSize(20).fillColor("#123c46").text(invoice ? "PharmaLink Invoice" : "PharmaLink Purchase Order")
  document.moveDown().fontSize(10).fillColor("#4b6470").text(`Document: ${invoice ? order.invoiceNumber ?? order.poNumber ?? order.id : order.poNumber ?? order.id}`)
  document.text(`Date: ${order.createdAt.toLocaleDateString()}`)
  document.text(`Manufacturer: ${order.seller.name}`)
  document.text(`Stockist: ${order.buyer.name}`)
  document.moveDown().fillColor("#152b34")
  order.items.forEach((item, index) => document.text(`${index + 1}. ${item.product.name} | Qty ${item.quantity} | PTR Rs. ${item.price.toFixed(2)} | Line Rs. ${(item.price * item.quantity).toFixed(2)}`))
  document.moveDown().text(`Subtotal: Rs. ${order.subtotal.toFixed(2)}`)
  document.text(`Discount: Rs. ${order.discount.toFixed(2)}`)
  document.text(`GST: Rs. ${order.gst.toFixed(2)}`)
  document.fontSize(13).text(`Total: Rs. ${order.total.toFixed(2)}`)
  if (order.notes) document.moveDown().fontSize(10).text(`Notes: ${order.notes}`)
  document.end()
  const buffer = await done
  return new Response(new Uint8Array(buffer), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${invoice ? "invoice" : "purchase-order"}-${order.id}.pdf"` } })
}
