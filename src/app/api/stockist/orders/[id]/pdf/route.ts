import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateInvoiceOrPoPdf, PdfOrderData } from "@/lib/pdf-invoice"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "STOCKIST" || !session.user.organizationId) {
    return new Response("Unauthorized", { status: 401 })
  }

  const { id } = await params
  const order = await prisma.order.findFirst({
    where: { id, buyerId: session.user.organizationId },
    include: {
      seller: true,
      buyer: true,
      items: {
        include: {
          product: true,
          allocations: {
            include: {
              batch: true,
            },
          },
        },
      },
    },
  })

  if (!order) {
    return new Response("Order not found", { status: 404 })
  }

  const isInvoice = new URL(req.url).searchParams.get("type") === "invoice"

  // If invoice is requested but no invoiceNumber yet, assign one on the fly for confirmed/shipped/delivered orders
  if (isInvoice && !order.invoiceNumber && ["APPROVED", "PACKED", "DISPATCHED", "DELIVERED"].includes(order.status)) {
    const invNumber = `INV-${new Date().getFullYear()}-${order.id.slice(-7).toUpperCase()}`
    await prisma.order.update({
      where: { id: order.id },
      data: { invoiceNumber: invNumber, invoiceCreatedAt: new Date() },
    })
    order.invoiceNumber = invNumber
    order.invoiceCreatedAt = new Date()
  }

  const pdfData: PdfOrderData = {
    id: order.id,
    poNumber: order.poNumber,
    invoiceNumber: order.invoiceNumber,
    createdAt: order.createdAt,
    invoiceCreatedAt: order.invoiceCreatedAt,
    status: order.status,
    isPaid: order.isPaid,
    transporter: order.transporter,
    trackingNumber: order.trackingNumber,
    expectedDelivery: order.expectedDelivery,
    subtotal: order.subtotal,
    discount: order.discount,
    gst: order.gst,
    total: order.total,
    notes: order.notes,
    seller: {
      name: order.seller.name,
      address: order.seller.address,
      drugLicense: order.seller.drugLicense,
      gstNumber: order.seller.gstNumber,
      region: order.seller.region,
    },
    buyer: {
      name: order.buyer.name,
      address: order.buyer.address,
      drugLicense: order.buyer.drugLicense,
      gstNumber: order.buyer.gstNumber,
      region: order.buyer.region,
    },
    items: order.items.map((item) => ({
      quantity: item.quantity,
      freeQuantity: item.freeQuantity,
      price: item.price,
      product: {
        name: item.product.name,
        genericName: item.product.genericName,
        packSize: item.product.packSize,
        gstPercent: item.product.gstPercent,
        hsnCode: item.product.hsnCode,
        mrp: item.product.mrp,
      },
      allocations: item.allocations.map((a) => ({
        quantity: a.quantity,
        batch: {
          batchNumber: a.batch.batchNumber,
          expiryDate: a.batch.expiryDate,
        },
      })),
    })),
  }

  const pdfBuffer = await generateInvoiceOrPoPdf(pdfData, isInvoice)
  const filename = isInvoice
    ? `${order.invoiceNumber || "invoice"}-${order.id.slice(-6)}.pdf`
    : `${order.poNumber || "purchase-order"}-${order.id.slice(-6)}.pdf`

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
