import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { ArrowUpRight, Boxes, ClipboardList, Users, TrendingUp } from "lucide-react"

export default async function ManufacturerDashboard() {
  const session = await getServerSession(authOptions)
  
  const productCount = await prisma.product.count({
    where: { manufacturerId: session?.user.organizationId }
  })
  
  const pendingOrders = await prisma.order.count({
    where: { 
      sellerId: session?.user.organizationId,
      status: "PLACED"
    }
  })

  const accessRequests = await prisma.accessGrant.count({
    where: { manufacturerId: session?.user.organizationId, status: "PENDING" },
  })

  const recentOrders = await prisma.order.findMany({
    where: { sellerId: session?.user.organizationId },
    include: { buyer: true },
    orderBy: { createdAt: "desc" },
    take: 4,
  })

  const inventory = await prisma.batch.aggregate({
    _sum: { quantity: true },
    where: { product: { manufacturerId: session?.user.organizationId } },
  })

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="eyebrow">Manufacturer workspace</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Your supply network at a glance</h2>
          <p className="mt-2 text-muted-foreground">Keep catalogue, inventory, and buyer access moving together.</p>
        </div>
        <Link href="/manufacturer/catalogue" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:bg-primary/90">
          <Boxes className="size-4" /> Manage catalogue <ArrowUpRight className="size-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="surface-card border-0"><CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Active products</CardTitle><Boxes className="size-4 text-primary" /></CardHeader><CardContent><p className="number text-3xl font-semibold">{productCount}</p><p className="mt-1 text-xs text-muted-foreground">Across your live catalogue</p></CardContent></Card>
        <Card className="surface-card border-0"><CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pending orders</CardTitle><ClipboardList className="size-4 text-amber-600" /></CardHeader><CardContent><p className="number text-3xl font-semibold text-amber-700">{pendingOrders}</p><p className="mt-1 text-xs text-muted-foreground">Ready for your decision</p></CardContent></Card>
        <Card className="surface-card border-0"><CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Access requests</CardTitle><Users className="size-4 text-sky-600" /></CardHeader><CardContent><p className="number text-3xl font-semibold text-sky-700">{accessRequests}</p><p className="mt-1 text-xs text-muted-foreground">Stockists waiting to connect</p></CardContent></Card>
        <Card className="surface-card border-0"><CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Units on hand</CardTitle><TrendingUp className="size-4 text-emerald-600" /></CardHeader><CardContent><p className="number text-3xl font-semibold text-emerald-700">{(inventory._sum.quantity ?? 0).toLocaleString()}</p><p className="mt-1 text-xs text-muted-foreground">Across all active batches</p></CardContent></Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <Card className="surface-card border-0"><CardHeader className="flex-row items-center justify-between"><div><p className="eyebrow">Live queue</p><CardTitle className="mt-1">Recent purchase orders</CardTitle></div><Link href="/manufacturer" className="text-sm font-medium text-primary hover:underline">View all</Link></CardHeader><CardContent className="space-y-3">
          {recentOrders.length === 0 ? <div className="rounded-xl bg-muted/60 p-6 text-sm text-muted-foreground">No purchase orders yet. Approved stockists will appear here when they place a PO.</div> : recentOrders.map((order) => <div key={order.id} className="flex flex-col gap-3 rounded-xl border border-border/70 bg-white/60 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{order.buyer.name}</p><p className="mt-1 text-xs text-muted-foreground">PO {order.id.slice(-8).toUpperCase()} · {new Date(order.createdAt).toLocaleDateString()}</p></div><div className="flex items-center gap-4"><span className="number font-semibold">₹{order.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span><Badge variant={order.status === "PLACED" ? "secondary" : "outline"}>{order.status}</Badge></div></div>)}
        </CardContent></Card>
        <Card className="border-0 bg-[linear-gradient(145deg,oklch(0.27_0.07_220),oklch(0.34_0.1_177))] text-white shadow-xl"><CardHeader><p className="eyebrow text-emerald-200">Next best action</p><CardTitle className="mt-1 text-white">Clear your access queue</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-white/70">Approved stockists can see live pricing and place orders immediately. Review their licenses before granting access.</p><Link href="/manufacturer/access-requests" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-emerald-200 hover:text-white">Review requests <ArrowUpRight className="size-4" /></Link></CardContent></Card>
      </div>
    </div>
  )
}
