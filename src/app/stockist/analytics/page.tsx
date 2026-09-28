"use client"

import { useMemo, useState } from "react"
import { ArrowDownRight, ArrowUpRight, BarChart3, Coins, PackageSearch, Receipt } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { CardSkeleton, StatSkeleton } from "@/components/skeletons"
import { BarChart, type BarChartPoint } from "@/components/charts/bar-chart"
import { BarList } from "@/components/charts/bar-list"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useApiResource } from "@/hooks/use-api-resource"
import { cn } from "@/lib/utils"

type SpendBucket = { label: string; value: number; share: number; detail?: string }

type SpendReport = {
  generatedAt: string
  rangeLabel: string
  orderCount: number
  total: number
  changePercent: number | null
  averageOrderValue: number
  previousTotal: number
  byMonth: (SpendBucket & { periodKey: string })[]
  byManufacturer: SpendBucket[]
  byCategory: SpendBucket[]
  topManufacturer: SpendBucket | null
  topCategory: SpendBucket | null
  assumptions: { label: string; value: string }[]
}

type SpendEnvelope = {
  generatedAt: string
  months: number
  spend: SpendReport
  procurement: { allTime: number; last12Months: number; changePercent: number | null; orderCount: number }
}

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
})

const shortCurrency = (value: number) =>
  value >= 100_000
    ? `₹${(value / 100_000).toFixed(1)}L`
    : value >= 1_000
      ? `₹${Math.round(value / 1000)}k`
      : `₹${Math.round(value)}`

export default function AnalyticsPage() {
  // The window selector is a client-side view over the longest history the
  // analytics model returns, so the "All time" view can slice it freely.
  const { data, error, loading, refresh } = useApiResource<SpendEnvelope>(
    "/api/stockist/analytics/spend?months=24",
  )
  const [window, setWindow] = useState<"all" | "12m" | "6m">("12m")
  const report = data?.spend

  const months = useMemo(() => {
    const all = report?.byMonth ?? []
    if (window === "all") return all
    const limit = window === "6m" ? 6 : 12
    return all.slice(-limit)
  }, [report?.byMonth, window])

  const chartData = useMemo<BarChartPoint[]>(
    () =>
      months.map((point) => ({
        key: point.periodKey,
        label: point.label,
        value: point.value,
        detail: point.detail,
      })),
    [months],
  )

  const totalInWindow = months.reduce((sum, point) => sum + point.value, 0)
  const change = report?.changePercent ?? null
  const rising = change !== null && change > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Spend analytics"
        description="Where your procurement money goes, calculated from your own purchase orders. Month, manufacturer and category breakdowns use the same server-side model that drives reorder timing."
        meta={
          report ? (
            <span className="text-xs text-muted-foreground">
              {report.rangeLabel} · {report.orderCount} orders · updated{" "}
              {new Date(report.generatedAt).toLocaleString("en-IN")}
            </span>
          ) : null
        }
      />

      {error ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-5">
            <p className="text-sm text-destructive">{error}</p>
            <button type="button" onClick={refresh} className="text-sm font-semibold text-primary hover:underline">
              Try again
            </button>
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <StatSkeleton />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            icon={Coins}
            label="Total spend"
            value={currency.format(report?.total ?? 0)}
            hint={report?.rangeLabel ?? "All purchase orders"}
          />
          <Metric
            icon={BarChart3}
            label="Period change"
            value={change === null ? "—" : `${change >= 0 ? "+" : ""}${change.toFixed(0)}%`}
            hint={report?.previousTotal ? `Previous ${currency.format(report.previousTotal)}` : "No prior window"}
            tone={change === null ? "muted" : rising ? "warning" : "ok"}
            icon2={change === null ? undefined : rising ? ArrowUpRight : ArrowDownRight}
          />
          <Metric
            icon={Receipt}
            label="Average order value"
            value={currency.format(report?.averageOrderValue ?? 0)}
            hint={`${report?.orderCount ?? 0} purchase orders`}
          />
          <Metric
            icon={PackageSearch}
            label="Top supplier"
            value={report?.topManufacturer?.label ?? "—"}
            hint={report?.topManufacturer ? `${report.topManufacturer.share.toFixed(0)}% of spend` : "No spend yet"}
          />
        </div>
      )}

      {loading ? (
        <CardSkeleton />
      ) : (
        <Card className="surface-card border-0">
          <CardHeader className="gap-4">
            <div>
              <CardTitle>Monthly spend</CardTitle>
              <CardDescription>
                Net of scheme discounts and GST, from placed and delivered purchase orders.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Choose time window">
              {(["6m", "12m", "all"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setWindow(option)}
                  aria-pressed={window === option}
                  className={cn(
                    "h-8 rounded-lg px-3 text-sm font-medium transition",
                    window === option ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted",
                  )}
                >
                  {option === "6m" ? "6 months" : option === "12m" ? "12 months" : "All time"}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {chartData.length ? (
              <BarChart
                data={chartData}
                height={260}
                ariaLabel="Monthly procurement spend"
                primaryLabel="Spend"
                valueFormatter={shortCurrency}
              />
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Spend history will appear once purchase orders are placed.
              </p>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              Showing {months.length} month{months.length === 1 ? "" : "s"} ·{" "}
              <span className="number">{currency.format(totalInWindow)}</span> in this view.
            </p>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="surface-card border-0">
            <CardHeader>
              <CardTitle>Spend by manufacturer</CardTitle>
              <CardDescription>Supplier concentration and how much you rely on each.</CardDescription>
            </CardHeader>
            <CardContent>
              <BarList
                items={(report?.byManufacturer ?? []).map((item) => ({
                  key: item.label,
                  label: item.label,
                  value: item.value,
                  detail: `${item.share.toFixed(0)}%`,
                }))}
                valueFormatter={currency.format}
                emptyMessage="Supplier spend appears once orders are placed."
              />
            </CardContent>
          </Card>

          <Card className="surface-card border-0">
            <CardHeader>
              <CardTitle>Spend by category</CardTitle>
              <CardDescription>Therapeutic mix, useful for planning working capital.</CardDescription>
            </CardHeader>
            <CardContent>
              <BarList
                items={(report?.byCategory ?? []).map((item) => ({
                  key: item.label,
                  label: item.label,
                  value: item.value,
                  detail: `${item.share.toFixed(0)}%`,
                }))}
                valueFormatter={currency.format}
                emptyMessage="Category spend appears once orders are placed."
                barClassName="bg-emerald-500/70"
              />
            </CardContent>
          </Card>
        </div>
      )}

      {report && report.assumptions.length > 0 ? (
        <Card className="surface-card border-0">
          <CardHeader>
            <CardTitle>Method and assumptions</CardTitle>
            <CardDescription>So the numbers can be audited against your own books.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {report.assumptions.map((assumption) => (
                <div key={assumption.label} className="rounded-xl bg-muted/50 p-3">
                  <dt className="text-xs font-medium">{assumption.label}</dt>
                  <dd className="mt-1 text-xs leading-5 text-muted-foreground">{assumption.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
  icon2: Icon2,
}: {
  icon: typeof Coins
  label: string
  value: string
  hint: string
  tone?: "default" | "ok" | "warning" | "muted"
  icon2?: typeof ArrowUpRight
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
        {Icon2 ? <Icon2 className="ml-auto size-4" /> : null}
      </div>
      <p
        className={cn(
          "number mt-3 truncate text-2xl font-semibold",
          tone === "ok" && "text-emerald-700 dark:text-emerald-400",
          tone === "warning" && "text-amber-700 dark:text-amber-400",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {value}
      </p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}
