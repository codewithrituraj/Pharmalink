"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowUpRight,
  BrainCircuit,
  CalendarClock,
  Info,
  PackageCheck,
  RefreshCw,
  Sparkles,
  TrendingUp,
  TriangleAlert,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { CardSkeleton, StatSkeleton } from "@/components/skeletons"
import { BarChart, type BarChartPoint } from "@/components/charts/bar-chart"
import { ReorderButton } from "@/app/stockist/reorder-button"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useApiResource } from "@/hooks/use-api-resource"
import { cn } from "@/lib/utils"

type Trend = "UP" | "DOWN" | "FLAT" | "UNKNOWN"

type ReorderSuggestion = {
  productId: string
  productName: string
  manufacturerId: string
  manufacturerName: string
  ptr: number
  onHand: number
  avgDailyDemand: number | null
  daysOfStock: number | null
  leadTimeDays: number
  suggestedQuantity: number
  estimatedCost: number
  severity: "CRITICAL" | "WARNING" | "WATCH" | "OK"
  reason: string
  timing: string
  stockoutDate: string | null
}

type ForecastPoint = {
  periodStart: string
  label: string
  actual: number | null
  forecast: number | null
  lower: number | null
  upper: number | null
  isForecast: boolean
  hasRecord: boolean
}

type ForecastBlock = {
  productId: string
  productName: string
  trend: Trend
  direction: number
  directionLabel: string
  nextPeriod: number | null
  nextMonthDemand: number | null
  coverageMonths: number | null
  series: ForecastPoint[]
  assumptions: string[]
  historyPoints: number
  confidence: "HIGH" | "MEDIUM" | "LOW"
}

type InsightsPayload = {
  generatedAt: string
  products: {
    forecasts: ForecastBlock[]
    stockoutRisk: {
      productId: string
      productName: string
      onHand: number
      avgDailyDemand: number | null
      daysOfStock: number | null
      stockoutDate: string | null
      severity: "CRITICAL" | "WARNING" | "WATCH" | "OK"
      explanation: string
    }[]
    reorder: ReorderSuggestion[]
  }
  summary: {
    productsAnalysed: number
    criticalReorders: number
    atRiskExpiring: number
    stockoutRisks: number
  }
}

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
})

const trendMeta: Record<
  Trend,
  { label: string; className: string; badge: "success" | "warning" | "outline" }
> = {
  UP: { label: "Rising demand", className: "text-amber-700 dark:text-amber-400", badge: "warning" },
  DOWN: { label: "Falling demand", className: "text-emerald-700 dark:text-emerald-400", badge: "success" },
  FLAT: { label: "Stable", className: "text-muted-foreground", badge: "outline" },
  UNKNOWN: { label: "Not enough data", className: "text-muted-foreground", badge: "outline" },
}

export default function InsightsPage() {
  const { data, error, loading, refresh } = useApiResource<InsightsPayload>("/api/stockist/insights")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const forecasts = useMemo(() => data?.products.forecasts ?? [], [data?.products.forecasts])
  const selected = useMemo<ForecastBlock | null>(() => {
    if (forecasts.length === 0) return null
    const match = forecasts.find((item) => item.productId === selectedId)
    return match ?? forecasts[0]
  }, [forecasts, selectedId])

  const reorders = useMemo(
    () => [...(data?.products.reorder ?? [])].sort((a, b) => b.severity.localeCompare(a.severity)),
    [data?.products.reorder],
  )

  const actionable = reorders.filter((item) => item.severity !== "OK")

  const chartData = useMemo<BarChartPoint[]>(
    () =>
      (selected?.series ?? []).map((point) => ({
        key: point.periodStart,
        label: point.label,
        value: point.actual,
        forecast: point.forecast,
        band: point.lower !== null && point.upper !== null ? { lower: point.lower, upper: point.upper } : null,
        detail: point.isForecast
          ? "Modelled"
          : point.hasRecord
            ? "Delivered"
            : "No orders recorded",
      })),
    [selected?.series],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Smart insights"
        description="Demand forecasts, stock-out risk and expiry exposure, calculated on the server from your delivered purchase orders and current batch stock. Every number shows the reasoning behind it."
        actions={
          <Button variant="outline" onClick={refresh} disabled={loading}>
            <RefreshCw className="size-4" /> Recalculate
          </Button>
        }
        meta={
          data ? (
            <span className="text-xs text-muted-foreground">
              Last calculated {new Date(data.generatedAt).toLocaleString("en-IN")}
            </span>
          ) : null
        }
      />

      {error ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-5">
            <p className="text-sm text-destructive">{error}</p>
            <Button size="sm" variant="outline" onClick={refresh}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <StatSkeleton />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={BrainCircuit} label="Products analysed" value={data?.summary.productsAnalysed ?? 0} hint="with demand history" />
          <Metric
            icon={PackageCheck}
            label="Urgent reorders"
            value={data?.summary.criticalReorders ?? 0}
            hint="would stock out inside lead time"
            tone={(data?.summary.criticalReorders ?? 0) > 0 ? "danger" : "ok"}
          />
          <Metric
            icon={TriangleAlert}
            label="Stock-out risks"
            value={data?.summary.stockoutRisks ?? 0}
            hint="cover shorter than lead time"
            tone={(data?.summary.stockoutRisks ?? 0) > 0 ? "warning" : "ok"}
          />
          <Metric
            icon={CalendarClock}
            label="Batches expiring"
            value={data?.summary.atRiskExpiring ?? 0}
            hint="inside 90 days"
            tone={(data?.summary.atRiskExpiring ?? 0) > 0 ? "warning" : "ok"}
          />
        </div>
      )}

      {loading ? (
        <CardSkeleton />
      ) : (
        <Card className="surface-card border-0">
          <CardHeader className="gap-4">
            <div>
              <CardTitle>Demand forecast</CardTitle>
              <CardDescription>
                Six months of delivered history and a three-month model. Dashed bars are the projection; the
                shaded band is the 80% prediction range.
              </CardDescription>
            </div>
            {forecasts.length > 1 ? (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Choose a product">
                {forecasts.slice(0, 6).map((forecast) => (
                  <Button
                    key={forecast.productId}
                    size="sm"
                    variant={selected?.productId === forecast.productId ? "default" : "outline"}
                    onClick={() => setSelectedId(forecast.productId)}
                  >
                    {forecast.productName.split(" ")[0]}
                  </Button>
                ))}
              </div>
            ) : null}
          </CardHeader>
          <CardContent>
            {!selected ? (
              <EmptyState
                icon={TrendingUp}
                title="No demand history yet"
                description="Once your first orders are delivered we model monthly demand from that history. Start by placing an order from the catalogue."
                action={
                  <Link href="/stockist/catalogue" className={buttonVariants()}>
                    Browse catalogue <ArrowUpRight className="size-4" />
                  </Link>
                }
              />
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold">{selected.productName}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selected.historyPoints} month{selected.historyPoints === 1 ? "" : "s"} of history ·{" "}
                      {selected.confidence.toLowerCase()} confidence
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={trendMeta[selected.trend].badge}>{trendMeta[selected.trend].label}</Badge>
                    {selected.coverageMonths !== null ? (
                      <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                        {selected.coverageMonths.toFixed(1)} months of cover
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-primary/85" /> Delivered
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm border border-dashed border-primary bg-primary/20" /> Forecast
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-primary/10" /> 80% band
                  </span>
                </div>

                <BarChart
                  data={chartData}
                  height={260}
                  ariaLabel={`Monthly demand forecast for ${selected.productName}`}
                  primaryLabel="Delivered"
                  forecastLabel="Forecast"
                />

                <div className="grid gap-4 sm:grid-cols-3">
                  <Figure
                    label="Next month demand"
                    value={selected.nextPeriod !== null ? `${selected.nextPeriod.toFixed(0)} units` : "—"}
                  />
                  <Figure
                    label="Trend"
                    value={`${selected.direction >= 0 ? "+" : ""}${selected.direction.toFixed(0)}%`}
                    hint={selected.directionLabel}
                    tone={selected.trend === "UP" ? "warning" : selected.trend === "DOWN" ? "ok" : "muted"}
                  />
                  <Figure
                    label="Runway"
                    value={
                      selected.coverageMonths !== null ? `${selected.coverageMonths.toFixed(1)} months` : "—"
                    }
                    hint="at current stock and demand"
                  />
                </div>

                <details className="rounded-xl bg-muted/60 p-4 text-sm">
                  <summary className="flex cursor-pointer items-center gap-2 font-medium">
                    <Info className="size-4" /> How this forecast is calculated
                  </summary>
                  <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted-foreground">
                    {selected.assumptions.map((assumption) => (
                      <li key={assumption}>{assumption}</li>
                    ))}
                  </ul>
                </details>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        {loading ? (
          <CardSkeleton />
        ) : (
          <Card className="surface-card border-0">
            <CardHeader>
              <CardTitle>Reorder suggestions</CardTitle>
              <CardDescription>
                Each quantity covers the lead time plus a safety buffer. One click adds it to your live
                purchase order.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {actionable.length === 0 ? (
                <EmptyState
                  icon={Sparkles}
                  title="Stock levels are healthy"
                  description="No product currently needs a reorder. Suggestions appear when projected cover drops below lead time plus safety stock."
                />
              ) : (
                <ul className="space-y-3">
                  {actionable.slice(0, 6).map((item) => (
                    <li
                      key={item.productId}
                      className="rounded-2xl border border-border/70 bg-card p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium">{item.productName}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {item.manufacturerName} · lead time {item.leadTimeDays} days
                          </p>
                        </div>
                        <Badge
                          variant={
                            item.severity === "CRITICAL"
                              ? "destructive"
                              : item.severity === "WARNING"
                                ? "warning"
                                : "outline"
                          }
                        >
                          {item.severity === "CRITICAL" ? "Order now" : item.severity === "WARNING" ? "Reorder soon" : "Watch"}
                        </Badge>
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">{item.reason}</p>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs text-muted-foreground">
                          <p>{item.timing}</p>
                          <p className="mt-1 font-medium text-foreground">
                            {item.suggestedQuantity} units · {currency.format(item.estimatedCost)}
                          </p>
                        </div>
                        <ReorderButton
                          manufacturerId={item.manufacturerId}
                          productId={item.productId}
                          quantity={item.suggestedQuantity}
                          label="Add to PO"
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {loading ? (
          <CardSkeleton />
        ) : (
          <Card className="surface-card border-0">
            <CardHeader>
              <CardTitle>Stock-out watch</CardTitle>
              <CardDescription>
                Products where days of stock sits close to the manufacturer&rsquo;s lead time.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(data?.products.stockoutRisk.length ?? 0) === 0 ? (
                <EmptyState
                  icon={PackageCheck}
                  title="No stock-out risk"
                  description="Every product has at least its lead-time cover in stock right now."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {(data?.products.stockoutRisk ?? []).slice(0, 8).map((risk) => (
                    <li key={risk.productId} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{risk.productName}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{risk.explanation}</p>
                      </div>
                      <div className="text-right">
                        <p className="number text-sm font-semibold">
                          {risk.daysOfStock !== null ? `${risk.daysOfStock} days` : "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {risk.onHand.toLocaleString("en-IN")} units on hand
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function Figure({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string
  value: string
  hint?: string
  tone?: "ok" | "warning" | "muted" | "default"
}) {
  return (
    <div className="rounded-xl border border-border/70 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "number mt-2 text-lg font-semibold",
          tone === "warning" && "text-amber-700 dark:text-amber-400",
          tone === "ok" && "text-emerald-700 dark:text-emerald-400",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
  hint,
  tone = "ok",
}: {
  icon: typeof BrainCircuit
  label: string
  value: number
  hint: string
  tone?: "ok" | "warning" | "danger"
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="number mt-3 text-2xl font-semibold">{value}</p>
      <p
        className={cn(
          "mt-1 text-xs",
          tone === "ok"
            ? "text-muted-foreground"
            : tone === "warning"
              ? "text-amber-600 dark:text-amber-400"
              : "text-destructive",
        )}
      >
        {hint}
      </p>
    </div>
  )
}
