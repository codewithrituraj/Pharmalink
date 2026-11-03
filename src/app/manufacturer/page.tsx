import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { ArrowUpRight, Boxes, ClipboardList, Users, TrendingUp } from "lucide-react"
import { ManufacturerDashboardCharts } from "@/components/manufacturer/dashboard-charts"

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
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const [ordersToday, monthlyRevenue, lowAvailability, topProducts, topStockists] = await Promise.all([
    prisma.order.count({ where: { sellerId: session?.user.organizationId, createdAt: { gte: todayStart } } }),
    prisma.order.aggregate({ _sum: { total: true }, where: { sellerId: session?.user.organizationId, createdAt: { gte: monthStart }, status: { notIn: ["CANCELLED", "REJECTED"] } } }),
    prisma.product.findMany({ where: { manufacturerId: session?.user.organizationId, availability: { lte: 100 } }, select: { id: true, name: true, availability: true }, take: 5, orderBy: { availability: "asc" } }),
    prisma.orderItem.groupBy({ by: ["productId"], _sum: { quantity: true }, where: { order: { sellerId: session?.user.organizationId, status: { notIn: ["CANCELLED", "REJECTED"] } } }, orderBy: { _sum: { quantity: "desc" } }, take: 3 }),
    prisma.order.groupBy({ by: ["buyerId"], _sum: { total: true }, where: { sellerId: session?.user.organizationId, status: { notIn: ["CANCELLED", "REJECTED"] } }, orderBy: { _sum: { total: "desc" } }, take: 3 }),
  ])
  const productNames = await prisma.product.findMany({ where: { id: { in: topProducts.map((row) => row.productId) } }, select: { id: true, name: true } })
  const stockistNames = await prisma.organization.findMany({ where: { id: { in: topStockists.map((row) => row.buyerId) } }, select: { id: true, name: true } })
  const chartOrders = await prisma.order.findMany({
    where: { sellerId: session?.user.organizationId, status: { notIn: ["CANCELLED", "REJECTED", "PLACED"] }, createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1) } },
    include: { items: { include: { product: { select: { category: true } } } } },
  })
  const months = Array.from({ length: 6 }, (_, offset) => new Date(new Date().getFullYear(), new Date().getMonth() - 5 + offset, 1))
  const monthlySales = months.map((month) => {
    const key = `${month.getFullYear()}-${month.getMonth()}`
    const total = chartOrders.filter((order) => `${order.createdAt.getFullYear()}-${order.createdAt.getMonth()}` === key).reduce((sum, order) => sum + order.total, 0)
    return { key, label: month.toLocaleDateString("en-IN", { month: "short" }), value: total }
  })
  const categories = new Map<string, number>()
  for (const order of chartOrders) for (const item of order.items) categories.set(item.product.category, (categories.get(item.product.category) ?? 0) + item.price * item.quantity)
  const categorySales = [...categories.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([category, value]) => ({ key: category, label: category, value }))

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

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="surface-card border-0"><CardHeader><CardTitle className="text-sm">Orders today · {ordersToday}</CardTitle></CardHeader><CardContent className="space-y-2 text-sm text-muted-foreground"><p>Revenue this month: <b className="text-foreground">₹{(monthlyRevenue._sum.total ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</b></p><p>Pending confirmations: <b className="text-foreground">{pendingOrders}</b></p></CardContent></Card>
        <Card className="surface-card border-0"><CardHeader><CardTitle className="text-sm">Top products</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">{topProducts.length ? topProducts.map((row) => <p key={row.productId}>{productNames.find((p) => p.id === row.productId)?.name ?? "Product"}<span className="float-right text-muted-foreground">{row._sum.quantity ?? 0} units</span></p>) : <p className="text-muted-foreground">No completed sales yet.</p>}</CardContent></Card>
        <Card className="surface-card border-0"><CardHeader><CardTitle className="text-sm">Top stockists</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">{topStockists.length ? topStockists.map((row) => <p key={row.buyerId}>{stockistNames.find((s) => s.id === row.buyerId)?.name ?? "Stockist"}<span className="float-right text-muted-foreground">₹{(row._sum.total ?? 0).toFixed(0)}</span></p>) : <p className="text-muted-foreground">No completed sales yet.</p>}</CardContent></Card>
      </div>
      {lowAvailability.length ? <Card className="border-amber-500/30 bg-amber-500/5"><CardContent className="py-4 text-sm"><b>Low availability:</b> {lowAvailability.map((product) => `${product.name} (${product.availability})`).join(", ")}</CardContent></Card> : null}

      <ManufacturerDashboardCharts monthlySales={monthlySales} categorySales={categorySales} />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <Card className="surface-card border-0"><CardHeader className="flex-row items-center justify-between"><div><p className="eyebrow">Live queue</p><CardTitle className="mt-1">Recent purchase orders</CardTitle></div><Link href="/manufacturer" className="-my-0.5 inline-flex items-center py-1 text-sm font-medium text-primary hover:underline">View all</Link></CardHeader><CardContent className="space-y-3">
          {recentOrders.length === 0 ? <div className="rounded-xl bg-muted/60 p-6 text-sm text-muted-foreground">No purchase orders yet. Approved stockists will appear here when they place a PO.</div> : recentOrders.map((order) => <div key={order.id} className="flex flex-col gap-3 rounded-xl border border-border/70 bg-white/60 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{order.buyer.name}</p><p className="mt-1 text-xs text-muted-foreground">PO {order.id.slice(-8).toUpperCase()} · {new Date(order.createdAt).toLocaleDateString()}</p></div><div className="flex items-center gap-4"><span className="number font-semibold">₹{order.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span><Badge variant={order.status === "PLACED" ? "secondary" : "outline"}>{order.status}</Badge></div></div>)}
        </CardContent></Card>
        <Card className="border-0 bg-[linear-gradient(145deg,oklch(0.27_0.07_220),oklch(0.34_0.1_177))] text-white shadow-xl"><CardHeader><p className="eyebrow text-emerald-200">Next best action</p><CardTitle className="mt-1 text-white">Clear your access queue</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-white/70">Approved stockists can see live pricing and place orders immediately. Review their licenses before granting access.</p><Link href="/manufacturer/access-requests" className="mt-5 inline-flex items-center gap-2 py-1 text-sm font-semibold text-emerald-200 hover:text-white">Review requests <ArrowUpRight className="size-4" /></Link></CardContent></Card>
      </div>
    </div>
  )
}
