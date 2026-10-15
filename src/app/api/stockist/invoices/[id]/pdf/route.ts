import { NextResponse } from "next/server"

import { generateInvoiceOrPoPdf } from "@/lib/pdf-invoice"
import { requireRole } from "@/lib/access"
import { prisma } from "@/lib/prisma"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("STOCKIST")
  if ("error" in auth) return auth.error

  const { id } = await params
  const order = await prisma.order.findFirst({
    where: {
      id,
      buyerId: auth.session.user.organizationId,
      invoiceNumber: { not: null },
    },
    include: {
      buyer: { select: { name: true, address: true, drugLicense: true, gstNumber: true, region: true } },
      seller: { select: { name: true, address: true, drugLicense: true, gstNumber: true, region: true } },
      items: {
        include: {
          product: { select: { name: true, genericName: true, packSize: true, gstPercent: true, hsnCode: true, mrp: true } },
          allocations: { include: { batch: { select: { batchNumber: true, expiryDate: true } } } },
        },
      },
    },
  })

  if (!order) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }

  const pdf = await generateInvoiceOrPoPdf(
    {
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
        allocations: item.allocations.map((allocation) => ({
          quantity: allocation.quantity,
          batch: {
            batchNumber: allocation.batch.batchNumber,
            expiryDate: allocation.batch.expiryDate,
          },
        })),
      })),
    },
    true,
  )

  const filename = order.invoiceNumber || `invoice-${order.id.slice(-8)}`
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=${filename}.pdf`,
    },
  })
}
