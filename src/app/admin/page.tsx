import { prisma } from "@/lib/prisma"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import Link from "next/link"
import { ArrowUpRight, Building2, ClipboardCheck, ShieldCheck } from "lucide-react"

import { JobsPanel } from "@/components/admin/jobs-panel"

export default async function AdminDashboard() {
  const pendingCount = await prisma.organization.count({ where: { status: "PENDING" } })
  const verifiedCount = await prisma.organization.count({ where: { status: "VERIFIED" } })
  const totalOrders = await prisma.order.count()
  const manufacturerCount = await prisma.organization.count({ where: { type: "MANUFACTURER" } })
  const stockistCount = await prisma.organization.count({ where: { type: "STOCKIST" } })

  return (
    <div className="space-y-8">
      <div><p className="eyebrow">Platform oversight</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Trust is the product</h2><p className="mt-2 text-muted-foreground">Keep every business and transaction accountable from one place.</p></div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="surface-card border-0"><CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pending review</CardTitle><ClipboardCheck className="size-4 text-amber-600" /></CardHeader><CardContent><p className="number text-3xl font-semibold text-amber-700">{pendingCount}</p><p className="mt-1 text-xs text-muted-foreground">Businesses awaiting verification</p></CardContent></Card>
        <Card className="surface-card border-0"><CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Verified businesses</CardTitle><ShieldCheck className="size-4 text-emerald-600" /></CardHeader><CardContent><p className="number text-3xl font-semibold text-emerald-700">{verifiedCount}</p><p className="mt-1 text-xs text-muted-foreground">Eligible to transact</p></CardContent></Card>
        <Card className="surface-card border-0"><CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Manufacturers</CardTitle><Building2 className="size-4 text-sky-600" /></CardHeader><CardContent><p className="number text-3xl font-semibold">{manufacturerCount}</p></CardContent></Card>
        <Card className="surface-card border-0"><CardHeader className="flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Purchase orders</CardTitle><span className="text-sm font-bold text-primary">PO</span></CardHeader><CardContent><p className="number text-3xl font-semibold">{totalOrders}</p><p className="mt-1 text-xs text-muted-foreground">Across {stockistCount} stockists</p></CardContent></Card>
      </div>
      <Card className="border-0 bg-white/80 shadow-sm"><CardHeader><CardTitle>Verification queue</CardTitle></CardHeader><CardContent className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><p className="max-w-xl text-sm leading-6 text-muted-foreground">Document review is the first control in a trusted pharmaceutical network. Clear pending applications and leave a reason when rejecting.</p><Link href="/admin/verifications" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">Open queue <ArrowUpRight className="size-4" /></Link></CardContent></Card>
      <JobsPanel />
    </div>
  )
}
