import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { buildStockistInsights } from "@/lib/insights"

/** Dashboard payload: reorder radar, stock-out watch, expiry summary and spend. */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "STOCKIST" || !session.user.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const insights = await buildStockistInsights(session.user.organizationId)

  // Forecasts are only useful where there is history to model, so products
  // without any are kept out of the chart but still counted in the summary.
  const modelled = insights.products.filter(
    (product) => product.forecast.sampleMonths > 0 || product.onHand > 0,
  )

  const productLeadTime = new Map(insights.products.map((product) => [product.productId, product.leadTimeDays]))

  const forecasts = modelled.map((product) => {
    const { forecast } = product
    const direction = forecast.trendPercentPerMonth
    const trend = forecast.sampleMonths === 0 ? "UNKNOWN" : direction > 3 ? "UP" : direction < -3 ? "DOWN" : "FLAT"
    return {
      productId: product.productId,
      productName: product.productName,
      trend,
      direction: Number(direction.toFixed(1)),
      directionLabel:
        trend === "UP"
          ? "demand is climbing month on month"
          : trend === "DOWN"
            ? "demand is easing month on month"
            : trend === "FLAT"
              ? "demand is holding steady"
              : "no delivered history yet",
      nextPeriod: forecast.forecastMonthly,
      nextMonthDemand: forecast.future[0]?.forecast ?? null,
      coverageMonths:
        forecast.dailyConsumption && forecast.dailyConsumption > 0
          ? Number((product.onHand / forecast.dailyConsumption / 30).toFixed(1))
          : null,
      historyPoints: forecast.sampleMonths,
      confidence: forecast.confidence,
      method: forecast.method,
      series: forecast.series.map((point) => ({
        periodStart: point.periodKey,
        label: point.label,
        actual: point.actual,
        forecast: point.forecast,
        lower: point.lowerBound,
        upper: point.upperBound,
        isForecast: point.actual === null,
      })),
      assumptions: forecast.assumptions.map((assumption) => `${assumption.label}: ${assumption.value}`),
    }
  })

  return NextResponse.json({
    generatedAt: insights.generatedAt,
    authorizedManufacturers: insights.authorizedManufacturers,
    productCount: insights.productCount,
    productsWithHistory: insights.productsWithHistory,
    inventory: insights.inventory,
    procurement: insights.procurement,
    products: {
      forecasts,
      stockoutRisk: insights.stockOutWatch.map((assessment) => ({
        productId: assessment.productId,
        productName: assessment.productName,
        onHand: assessment.onHand,
        avgDailyDemand: assessment.dailyConsumption,
        daysOfStock: assessment.daysOfCover,
        stockoutDate: assessment.stockOutDate,
        severity:
          assessment.risk === "OUT" || assessment.risk === "CRITICAL"
            ? "CRITICAL"
            : assessment.risk === "LOW"
              ? "WARNING"
              : "OK",
        explanation: assessment.detail || assessment.headline,
      })),
      reorder: insights.reorderRadar.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        manufacturerId: item.manufacturerId,
        manufacturerName: item.manufacturerName,
        ptr: item.unitPrice,
        onHand: item.onHand,
        avgDailyDemand: item.averageMonthly / 30,
        daysOfStock: item.daysOfCover,
        leadTimeDays: productLeadTime.get(item.productId) ?? 0,
        suggestedQuantity: item.suggestedQuantity,
        estimatedCost: item.estimatedCost,
        severity:
          item.urgency === "ORDER_NOW" ? "CRITICAL" : item.urgency === "ORDER_SOON" ? "WARNING" : "WATCH",
        reason: item.reason,
        timing: item.timing,
        stockoutDate: null,
      })),
    },
    summary: {
      productsAnalysed: insights.productCount,
      productsWithHistory: insights.productsWithHistory,
      criticalReorders: insights.reorderRadar.filter((item) => item.urgency === "ORDER_NOW").length,
      atRiskExpiring:
        insights.expiry.counts.EXPIRED +
        insights.expiry.counts.WITHIN_30 +
        insights.expiry.counts.WITHIN_60 +
        insights.expiry.counts.WITHIN_90,
      stockoutRisks: insights.stockOutWatch.filter((item) => item.belowLeadTime).length,
    },
    reorderRadar: insights.reorderRadar,
    stockOutWatch: insights.stockOutWatch,
    expiry: {
      generatedAt: insights.expiry.generatedAt,
      horizonDays: insights.expiry.horizonDays,
      totals: insights.expiry.totals,
      counts: insights.expiry.counts,
      assumptions: insights.expiry.assumptions,
      notes: insights.expiry.notes,
      batches: insights.expiry.batches
        .filter((batch) => batch.daysRemaining <= 90)
        .slice(0, 12),
    },
    spend: {
      generatedAt: insights.spend.generatedAt,
      rangeLabel: insights.spend.rangeLabel,
      orderCount: insights.spend.orderCount,
      total: insights.spend.total,
      changePercent: insights.spend.changePercent,
      averageOrderValue: insights.spend.averageOrderValue,
      byMonth: insights.spend.byMonth,
      byManufacturer: insights.spend.byManufacturer,
      byCategory: insights.spend.byCategory,
      topManufacturer: insights.spend.topManufacturer,
      topCategory: insights.spend.topCategory,
      assumptions: insights.spend.assumptions,
    },
  })
}
