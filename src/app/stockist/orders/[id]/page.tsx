import { getServerSession } from "next-auth/next"
import Link from "next/link"

import { authOptions } from "@/lib/auth"
import { loadOrderForBuyer } from "@/lib/order-detail"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

import { OrderDetail, type OrderDetail as OrderDetailData } from "./order-detail"

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)

  if (!session?.user.organizationId) return null

  const order = await loadOrderForBuyer(session.user.organizationId, id)

  if (!order) {
    return (
      <div className="space-y-6">
        <Card className="surface-card border-0">
          <CardContent className="space-y-4 py-16 text-center">
            <p className="text-lg font-medium">Order not found</p>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              This order does not exist, or it belongs to another organization.
            </p>
            <Link
              href="/stockist/orders"
              className={`${buttonVariants({ variant: "outline" })} min-h-11`}
            >
              Back to orders
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const detail: OrderDetailData = {
    id: order.id,
    poNumber: order.poNumber,
    status: order.status,
    total: order.total,
    subtotal: order.subtotal,
    discount: order.discount,
    gst: order.gst,
    isPaid: order.isPaid ?? false,
    notes: order.notes,
    transporter: order.transporter,
    trackingNumber: order.trackingNumber,
    expectedDelivery: order.expectedDelivery ? order.expectedDelivery.toISOString() : null,
    invoiceNumber: order.invoiceNumber,
    invoiceCreatedAt: order.invoiceCreatedAt ? order.invoiceCreatedAt.toISOString() : null,
    createdAt: order.createdAt.toISOString(),
    seller: {
      name: order.seller.name,
      address: order.seller.address,
      drugLicense: order.seller.drugLicense,
      gstNumber: order.seller.gstNumber,
    },
    buyer: {
      name: order.buyer.name,
      address: order.buyer.address,
      drugLicense: order.buyer.drugLicense,
      gstNumber: order.buyer.gstNumber,
    },
    items: order.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      freeQuantity: item.freeQuantity ?? 0,
      price: item.price,
      product: {
        id: item.product.id,
        name: item.product.name,
        genericName: item.product.genericName,
        packSize: item.product.packSize,
        mrp: item.product.mrp,
        ptr: item.product.ptr,
        availability: item.product.availability,
      },
      allocations: item.allocations?.map((a) => ({
        id: a.id,
        quantity: a.quantity,
        batch: {
          batchNumber: a.batch.batchNumber,
          expiryDate: a.batch.expiryDate.toISOString(),
        },
      })) || [],
    })),
    audits: order.audits.map((audit) => ({
      id: audit.id,
      status: audit.status,
      note: audit.note,
      createdAt: audit.createdAt.toISOString(),
    })),
  }

  return <OrderDetail initialOrder={detail} />
}
