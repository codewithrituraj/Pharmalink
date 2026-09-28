"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  CalendarClock,
  Download,
  Info,
  PackageCheck,
  ShieldAlert,
  TrendingDown,
  TriangleAlert,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { CardSkeleton, StatSkeleton } from "@/components/skeletons"
import { BarChart, type BarChartPoint } from "@/components/charts/bar-chart"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useApiResource } from "@/hooks/use-api-resource"
import { cn } from "@/lib/utils"

type Band = "EXPIRED" | "WITHIN_30" | "WITHIN_60" | "WITHIN_90" | "LATER"
type Action = "DISPOSE" | "RETURN_OR_CREDIT" | "SELL_FIRST" | "DO_NOT_REORDER" | "MONITOR"

type ExpiryBatch = {
  id: string
  productId: string
  productName: string
  genericName: string
  manufacturerName: string
  batchNumber: string
  quantity: number
  expiryDate: string
  receivedDate: string
  daysRemaining: number
  band: Band
  bandLabel: string
  action: Action
  actionLabel: string
  reason: string
  fefoRank: number
  unitsAtRisk: number
  valueAtRisk: number
  dailyConsumption: number | null
  daysOfCover: number | null
  source: "DELIVERY" | "MANUAL"
}

type ExpiryPayload = {
  generatedAt: string
  horizonDays: number
  totals: {
    batches: number
    units: number
    within30: number
    within60: number
    within90: number
    expired: number
    unitsAtRisk: number
    valueAtRisk: number
  }
  counts: Record<Band, number>
  batches: ExpiryBatch[]
  assumptions: { label: string; value: string }[]
  notes: string[]
}

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
})

const bandVariant: Record<Band, "destructive" | "warning" | "outline"> = {
  EXPIRED: "destructive",
  WITHIN_30: "destructive",
  WITHIN_60: "warning",
  WITHIN_90: "warning",
  LATER: "outline",
}

const actionVariant: Record<Action, "destructive" | "warning" | "success" | "outline"> = {
  DISPOSE: "destructive",
  RETURN_OR_CREDIT: "destructive",
  SELL_FIRST: "warning",
  DO_NOT_REORDER: "outline",
  MONITOR: "success",
}

const BAND_ORDER: Band[] = ["EXPIRED", "WITHIN_30", "WITHIN_60", "WITHIN_90", "LATER"]

export default function ExpiryPage() {
  const { data, error, loading, refresh } = useApiResource<ExpiryPayload>("/api/stockist/expiry")
  const [band, setBand] = useState<Band | "ALL">("ALL")

  const bands = useMemo<BarChartPoint[]>(
    () =>
      BAND_ORDER.filter((key) => key !== "LATER").map((key) => {
        const rows = (data?.batches ?? []).filter((batch) => batch.band === key)
        return {
          key,
          label: key === "EXPIRED" ? "Expired" : key === "WITHIN_30" ? "≤30d" : key === "WITHIN_60" ? "31–60d" : "61–90d",
          value: rows.reduce((sum, row) => sum + row.quantity, 0),
          detail: `${rows.length} batch${rows.length === 1 ? "" : "es"}`,
        }
      }),
    [data?.batches],
  )

  const valueByBand = useMemo<BarChartPoint[]>(
    () =>
      BAND_ORDER.filter((key) => key !== "LATER").map((key) => {
        const rows = (data?.batches ?? []).filter((batch) => batch.band === key)
        return {
          key: `${key}-value`,
          label: key === "EXPIRED" ? "Expired" : key === "WITHIN_30" ? "≤30d" : key === "WITHIN_60" ? "31–60d" : "61–90d",
          value: Math.round(rows.reduce((sum, row) => sum + row.valueAtRisk, 0)),
          detail: "Capital at risk if unsold",
        }
      }),
    [data?.batches],
  )

  const visible = useMemo(
    () =>
      (data?.batches ?? [])
        .filter((batch) => band === "ALL" || batch.band === band)
        .sort((a, b) => a.daysRemaining - b.daysRemaining),
    [data?.batches, band],
  )

  function downloadCsv() {
    const header = [
      "Product",
      "Generic",
      "Manufacturer",
      "Batch",
      "Quantity",
      "Expiry",
      "Days remaining",
      "Band",
      "FEFO rank",
      "Units at risk",
      "Value at risk",
      "Action",
      "Source",
    ]
    const rows = visible.map((batch) => [
      batch.productName,
      batch.genericName,
      batch.manufacturerName,
      batch.batchNumber,
      batch.quantity,
      batch.expiryDate,
      batch.daysRemaining,
      batch.bandLabel,
      batch.fefoRank,
      batch.unitsAtRisk,
      batch.valueAtRisk.toFixed(2),
      batch.actionLabel,
      batch.source === "DELIVERY" ? "Delivered order" : "Manual entry",
    ])
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = `pharmalink-expiry-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expiry manager"
        description="Every batch ranked by expiry date, with the units we expect to still be on hand at that date. Consumption is applied first-expiry-first-out, so a batch only carries risk once everything expiring before it is used up."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={downloadCsv} disabled={!visible.length}>
              <Download className="size-4" /> Export CSV
            </Button>
            <Link href="/stockist/inventory" className={buttonVariants({ variant: "outline" })}>
              Open inventory
            </Link>
          </div>
        }
        meta={
          data ? (
            <span className="text-xs text-muted-foreground">
              Generated {new Date(data.generatedAt).toLocaleString("en-IN")} · {data.horizonDays}-day horizon
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
          <Metric
            icon={CalendarClock}
            label="Batches tracked"
            value={data?.totals.batches ?? 0}
            hint={`${(data?.totals.units ?? 0).toLocaleString("en-IN")} units in scope`}
          />
          <Metric
            icon={TriangleAlert}
            label="Expiring ≤ 30 days"
            value={data?.totals.within30 ?? 0}
            hint={`${data?.counts.EXPIRED ?? 0} already expired`}
            tone={(data?.totals.within30 ?? 0) > 0 ? "danger" : "ok"}
          />
          <Metric
            icon={ShieldAlert}
            label="Units at risk"
            value={(data?.totals.unitsAtRisk ?? 0).toLocaleString("en-IN")}
            hint="still on hand at expiry"
            tone={(data?.totals.unitsAtRisk ?? 0) > 0 ? "warning" : "ok"}
          />
          <Metric
            icon={TrendingDown}
            label="Capital at risk"
            value={currency.format(data?.totals.valueAtRisk ?? 0)}
            hint="at your purchase price"
            tone={(data?.totals.valueAtRisk ?? 0) > 0 ? "warning" : "ok"}
          />
        </div>
      )}

      {loading ? (
        <CardSkeleton />
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="surface-card border-0">
            <CardHeader>
              <CardTitle>Units by expiry window</CardTitle>
              <CardDescription>Where the volume sits against the 90-day horizon.</CardDescription>
            </CardHeader>
            <CardContent>
              <BarChart data={bands} height={200} ariaLabel="Units by expiry window" primaryLabel="Units" />
            </CardContent>
          </Card>
          <Card className="surface-card border-0">
            <CardHeader>
              <CardTitle>Capital at risk by window</CardTitle>
              <CardDescription>
                Value of units we expect to still be unsold on the expiry date.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BarChart
                data={valueByBand}
                height={200}
                ariaLabel="Value at risk by expiry window"
                primaryLabel="Value at risk"
                valueFormatter={(value) => `₹${Math.round(value / 1000)}k`}
              />
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by expiry window">
        <Button size="sm" variant={band === "ALL" ? "default" : "outline"} onClick={() => setBand("ALL")}>
          All
        </Button>
        {BAND_ORDER.map((key) => {
          const count = data?.counts[key] ?? 0
          return (
            <Button
              key={key}
              size="sm"
              variant={band === key ? "default" : "outline"}
              onClick={() => setBand(key)}
              disabled={count === 0}
            >
              {key === "EXPIRED" ? "Expired" : key === "LATER" ? "Later" : `≤ ${key.split("_")[1].toLowerCase()}d`}
              <span className="number ml-1 opacity-70">{count}</span>
            </Button>
          )
        })}
      </div>

      {loading ? (
        <CardSkeleton />
      ) : visible.length === 0 ? (
        <Card className="surface-card border-0">
          <CardContent className="p-0">
            <EmptyState
              icon={PackageCheck}
              title="No batches in this window"
              description="Batches appear here as soon as they are received with an expiry date. Nothing is expiring inside the selected window."
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="surface-card border-0 p-0">
          <CardHeader className="border-b border-border">
            <CardTitle>FEFO action list</CardTitle>
            <CardDescription>
              {visible.length} batch{visible.length === 1 ? "" : "es"}, earliest expiry first. Rank 1 is the
              batch to dispense first.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {visible.map((batch) => (
                <li key={batch.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="number mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-secondary text-xs font-semibold text-primary">
                        {batch.fefoRank}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{batch.productName}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {batch.genericName} · {batch.manufacturerName}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={bandVariant[batch.band]}>
                        {batch.daysRemaining <= 0
                          ? `Expired ${Math.abs(batch.daysRemaining)}d ago`
                          : `${batch.daysRemaining} days`}
                      </Badge>
                      <Badge variant={actionVariant[batch.action]}>{batch.actionLabel}</Badge>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                    <span>
                      Batch <strong className="font-medium text-foreground">{batch.batchNumber}</strong> ·{" "}
                      <span className="number">{batch.quantity}</span> units
                    </span>
                    <span>
                      Expires{" "}
                      <strong className="font-medium text-foreground">
                        {new Date(batch.expiryDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </strong>
                    </span>
                    <span>
                      At risk{" "}
                      <strong className="number font-medium text-foreground">
                        {batch.unitsAtRisk} units
                      </strong>{" "}
                      ({currency.format(batch.valueAtRisk)})
                    </span>
                    <span>
                      Demand{" "}
                      <strong className="number font-medium text-foreground">
                        {batch.dailyConsumption !== null ? `${batch.dailyConsumption}/day` : "no history"}
                      </strong>
                    </span>
                  </div>

                  <p
                    className={cn(
                      "mt-3 rounded-lg px-3 py-2 text-xs leading-5",
                      batch.action === "MONITOR"
                        ? "bg-muted/60 text-muted-foreground"
                        : batch.action === "DO_NOT_REORDER"
                          ? "bg-muted/60 text-muted-foreground"
                          : "bg-amber-500/10 text-amber-900 dark:text-amber-200",
                    )}
                  >
                    {batch.reason}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {data && data.assumptions.length ? (
        <Card className="surface-card border-0">
          <CardHeader>
            <CardTitle>How these numbers are calculated</CardTitle>
            <CardDescription>Shown so you can check the inputs behind every action.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2">
              {data.assumptions.map((assumption) => (
                <div key={assumption.label} className="rounded-xl bg-muted/50 p-3">
                  <dt className="text-xs font-medium">{assumption.label}</dt>
                  <dd className="mt-1 text-xs text-muted-foreground">{assumption.value}</dd>
                </div>
              ))}
            </dl>
            {data.notes.length ? (
              <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                {data.notes.map((note) => (
                  <li key={note} className="flex gap-2">
                    <Info className="mt-0.5 size-3.5 shrink-0" />
                    {note}
                  </li>
                ))}
              </ul>
            ) : null}
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
  tone = "ok",
}: {
  icon: typeof CalendarClock
  label: string
  value: number | string
  hint: string
  tone?: "ok" | "warning" | "danger"
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="number mt-3 text-2xl font-semibold">{typeof value === "number" ? value : value}</p>
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
