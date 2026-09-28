import Link from "next/link"
import { getServerSession } from "next-auth/next"
import {
  ArrowUpRight,
  BarChart3,
  BrainCircuit,
  CalendarClock,
  ClipboardList,
  PackageSearch,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  TriangleAlert,
} from "lucide-react"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { buildStockistInsights } from "@/lib/insights"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { BarList } from "@/components/charts/bar-list"
import { SpendTrendChart } from "@/components/charts/spend-trend-chart"
import { NotificationRow } from "@/components/notifications/notification-row"
import type { NotificationSeverity } from "@/hooks/use-notifications"
import { formatCurrency } from "@/lib/format"
import { ReorderButton } from "./reorder-button"
import { cn } from "@/lib/utils"

function severityOf(value: string): NotificationSeverity {
  return value === "CRITICAL" || value === "WARNING" ? value : "INFO"
}

export default async function StockistDashboard() {
  const session = await getServerSession(authOptions)
  const organizationId = session?.user.organizationId
  const now = new Date()

  const [activeOrders, deliveredOrders, spendTotal, insights, latestNotifications] = organizationId
    ? await Promise.all([
        prisma.order.count({
          where: { buyerId: organizationId, status: { notIn: ["DELIVERED", "REJECTED", "CANCELLED"] } },
        }),
        prisma.order.count({ where: { buyerId: organizationId, status: "DELIVERED" } }),
        prisma.order.aggregate({ _sum: { total: true }, where: { buyerId: organizationId } }),
        buildStockistInsights(organizationId),
        prisma.notification.findMany({
          where: { organizationId },
          orderBy: { createdAt: "desc" },
          take: 4,
        }),
      ])
    : [
        0,
        0,
        { _sum: { total: null } },
        null,
        [],
      ]

  const spend = insights?.spend
  const atRiskExpiring =
    (insights?.expiry.counts.EXPIRED ?? 0) +
    (insights?.expiry.counts.WITHIN_30 ?? 0) +
    (insights?.expiry.counts.WITHIN_60 ?? 0) +
    (insights?.expiry.counts.WITHIN_90 ?? 0)
  const spendChart = (spend?.byMonth ?? [])
    .slice(-8)
    .map((point) => ({ key: point.periodKey, label: point.label, value: point.value }))

  const reorders = (insights?.reorderRadar ?? [])
    .filter((item) => item.urgency !== "MONITOR")
    .slice(0, 3)

  const expiringBatches = insights?.expiry.batches
    .filter((batch) => batch.daysRemaining <= 90)
    .slice(0, 4)

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="eyebrow">Stockist command centre</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">A clearer way to replenish</h2>
          <p className="mt-2 text-muted-foreground">
            Search authorised catalogues, watch risk, and keep your next order ready.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/stockist/insights" className={cn(buttonVariants({ variant: "outline" }))}>
            <BrainCircuit className="size-4" /> Smart insights
          </Link>
          <Link href="/stockist/catalogue" className={cn(buttonVariants())}>
            <PackageSearch className="size-4" /> Browse catalogue <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={ClipboardList}
          label="Active orders"
          value={String(activeOrders)}
          hint="Moving through fulfilment"
        />
        <StatCard
          icon={ShoppingCart}
          label="Delivered orders"
          value={String(deliveredOrders)}
          hint="Completed procurement cycles"
          tone="ok"
        />
        <StatCard
          icon={TrendingUp}
          label="Total procurement"
          value={formatCurrency(spend?.total ?? spendTotal._sum.total ?? 0)}
          hint="Across all purchase orders"
        />
        <StatCard
          icon={CalendarClock}
          label="Expiry watch"
          value={String(atRiskExpiring)}
          hint="FEFO batches inside 90 days"
          tone={atRiskExpiring > 0 ? "warning" : "ok"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-0 bg-[linear-gradient(145deg,oklch(0.27_0.07_220),oklch(0.34_0.1_177))] text-white shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-2">
              <BrainCircuit className="size-5 text-emerald-200" />
              <p className="eyebrow text-emerald-200">Decision support</p>
            </div>
            <CardTitle className="mt-1 text-white">Reorder radar</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-white/70">
              Quantities are sized to cover the manufacturer lead time plus a safety buffer, using your own
              delivered demand. Guidance only — not a regulatory or clinical recommendation.
            </p>
            {reorders.length ? (
              <div className="mt-6 space-y-3">
                {reorders.map((item) => (
                  <div key={item.productId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/10 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{item.productName}</p>
                      <p className="mt-0.5 text-xs text-white/60">
                        {item.suggestedQuantity} units · {item.timing}
                      </p>
                    </div>
                    <ReorderButton
                      manufacturerId={item.manufacturerId}
                      productId={item.productId}
                      quantity={item.suggestedQuantity}
                      variant="outline"
                      label="Add to PO"
                      className="border-white/30 bg-white/10 text-white hover:bg-white/20"
                    />
                  </div>
                ))}
                <Link
                  href="/stockist/insights"
                  className="-my-1 inline-flex items-center gap-1 py-1 text-sm font-semibold text-emerald-200 hover:text-white"
                >
                  See all suggestions <ArrowUpRight className="size-4" />
                </Link>
              </div>
            ) : (
              <div className="mt-6 rounded-xl bg-white/10 p-5">
                <p className="text-sm font-semibold text-white">No urgent reorders</p>
                <p className="mt-1 text-xs text-white/70">
                  Either stock covers your lead time everywhere, or you need delivered order history before the
                  model can size a reorder.
                </p>
                <Link
                  href="/stockist/insights"
                  className="mt-3 inline-flex items-center gap-1 py-1 text-sm font-semibold text-emerald-200 hover:text-white"
                >
                  Open smart insights <ArrowUpRight className="size-4" />
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="surface-card border-0">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <p className="eyebrow">Smart picks</p>
              <CardTitle className="mt-1">Available to replenish</CardTitle>
            </div>
            <Badge variant="outline">Decision support</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {reorders.length ? (
              reorders.map((item) => (
                <div key={item.productId} className="rounded-xl border border-border/70 bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.productName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.reason}</p>
                      {item.daysOfCover !== null ? (
                        <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                          Stock may run out in ~{item.daysOfCover} days
                        </p>
                      ) : null}
                    </div>
                    <ReorderButton
                      manufacturerId={item.manufacturerId}
                      productId={item.productId}
                      quantity={item.suggestedQuantity}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{item.timing}</span>
                    <span>
                      Suggested: {item.suggestedQuantity} units · {formatCurrency(item.estimatedCost)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl bg-muted/60 p-6 text-sm text-muted-foreground">
                Not enough demand history for recommendations yet. Delivered orders build the model.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="surface-card border-0">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <p className="eyebrow">Spend analytics</p>
              <CardTitle className="mt-1">Procurement trend</CardTitle>
            </div>
            <Link href="/stockist/analytics" className="-my-0.5 inline-flex items-center py-1 text-sm font-semibold text-primary hover:underline">
              Open analytics
            </Link>
          </CardHeader>
          <CardContent>
            {spendChart.length ? (
              <SpendTrendChart data={spendChart} ariaLabel="Monthly procurement spend" />
            ) : (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Spend history will appear after purchase orders are recorded.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="surface-card border-0">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <p className="eyebrow">Supplier mix</p>
              <CardTitle className="mt-1">Where spend goes</CardTitle>
            </div>
            <BarChart3 className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <BarList
              items={(spend?.byManufacturer ?? []).map((item) => ({
                key: item.label,
                label: item.label,
                value: item.value,
              }))}
              valueFormatter={(value) => formatCurrency(value)}
              emptyMessage="Supplier spend appears once orders are delivered."
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="surface-card border-0">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <p className="eyebrow">Expiry watch</p>
              <CardTitle className="mt-1">First to expire</CardTitle>
            </div>
            <Link href="/stockist/expiry" className="-my-0.5 inline-flex items-center py-1 text-sm font-semibold text-primary hover:underline">
              Full report
            </Link>
          </CardHeader>
          <CardContent>
            {expiringBatches?.length ? (
              <ul className="divide-y divide-border">
                {expiringBatches.map((batch) => (
                  <li key={batch.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{batch.productName}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Batch {batch.batchNumber} · {batch.quantity} units
                      </p>
                    </div>
                    <Badge variant={batch.daysRemaining <= 30 ? "destructive" : "warning"}>
                      <TriangleAlert className="size-3" />
                      {batch.daysRemaining <= 0 ? "Expired" : `${batch.daysRemaining} days`}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-xl bg-muted/60 p-6 text-sm text-muted-foreground">
                No batch expires within 90 days.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="surface-card border-0 p-0">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <p className="eyebrow">Live alerts</p>
              <CardTitle className="mt-1">Latest notifications</CardTitle>
            </div>
            <Link href="/stockist/notifications" className="-my-0.5 inline-flex items-center py-1 text-sm font-semibold text-primary hover:underline">
              See all
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {latestNotifications.length ? (
              <ul className="divide-y divide-border">
                {latestNotifications.map((notification) => (
                  <NotificationRow
                    key={notification.id}
                    notification={{
                      id: notification.id,
                      type: notification.type,
                      title: notification.title,
                      message: notification.message,
                      severity: severityOf(notification.severity),
                      link: notification.link,
                      readAt: notification.readAt ? notification.readAt.toISOString() : null,
                      createdAt: notification.createdAt.toISOString(),
                    }}
                    compact
                  />
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                <Sparkles className="size-6 text-muted-foreground" />
                <p className="text-sm font-medium">No alerts yet</p>
                <p className="text-xs text-muted-foreground">
                  Expiry, low-stock and scheme alerts land here. Last refreshed{" "}
                  {now.toLocaleString("en-IN")}.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: typeof ClipboardList
  label: string
  value: string
  hint: string
  tone?: "default" | "ok" | "warning"
}) {
  return (
    <Card className="surface-card border-0">
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon
          className={cn(
            "size-4",
            tone === "ok" ? "text-emerald-600" : tone === "warning" ? "text-amber-600" : "text-primary",
          )}
        />
      </CardHeader>
      <CardContent>
        <p
          className={cn(
            "number text-3xl font-semibold",
            tone === "ok" && "text-emerald-700 dark:text-emerald-400",
            tone === "warning" && "text-amber-700 dark:text-amber-400",
          )}
        >
          {value}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}
