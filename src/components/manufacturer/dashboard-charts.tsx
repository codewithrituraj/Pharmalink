"use client"

import { BarChart, type BarChartPoint } from "@/components/charts/bar-chart"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type Props = {
  monthlySales: BarChartPoint[]
  categorySales: BarChartPoint[]
}

/** Small, dependency-free charts that reuse the responsive chart primitive used by Phase 3. */
export function ManufacturerDashboardCharts({ monthlySales, categorySales }: Props) {
  const formatRupees = (value: number) => `₹${Math.round(value / 1000)}k`

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card className="surface-card border-0">
        <CardHeader>
          <CardTitle>Sales by month</CardTitle>
          <CardDescription>Confirmed, packed, shipped and delivered orders.</CardDescription>
        </CardHeader>
        <CardContent>
          <BarChart data={monthlySales} height={210} ariaLabel="Monthly sales" primaryLabel="Sales" valueFormatter={formatRupees} />
        </CardContent>
      </Card>
      <Card className="surface-card border-0">
        <CardHeader>
          <CardTitle>Sales by category</CardTitle>
          <CardDescription>Order-line revenue across your catalogue.</CardDescription>
        </CardHeader>
        <CardContent>
          <BarChart data={categorySales} height={210} ariaLabel="Sales by product category" primaryLabel="Sales" valueFormatter={formatRupees} />
        </CardContent>
      </Card>
    </div>
  )
}
