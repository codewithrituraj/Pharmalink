import { prisma } from "@/lib/prisma"
import { notify, type NotifyInput } from "@/lib/notifications"
import { buildStockistInsights } from "@/lib/insights"

export type JobTrigger = "SCHEDULE" | "MANUAL" | "SEED"

export type JobTypeCount = { created: number; skipped: number }

export type DailyJobResult = {
  created: number
  skipped: number
  byType: Record<string, JobTypeCount>
  stockists: number
  productsChecked: number
  expiryAlerts: number
  lowStockAlerts: number
  schemeAlerts: number
  jobRunId: string | null
  startedAt: string
  finishedAt: string
}

/**
 * Only bands that need a decision today are announced. The 61-90 day band stays
 * in the expiry report without generating a notification, so the alert list stays
 * short enough to act on.
 */
const EXPIRY_BAND_BY_DAYS: { limit: number; key: string }[] = [
  { limit: 0, key: "EXPIRED" },
  { limit: 30, key: "D30" },
  { limit: 60, key: "D60" },
]

const LOW_STOCK_WATCH_DAYS = 30

/** Per-stockist caps, highest risk first, so one bad day cannot flood the list. */
const MAX_EXPIRY_ALERTS = 8
const MAX_LOW_STOCK_ALERTS = 5
const MAX_SCHEME_ALERTS = 3

function lowStockBand(daysOfCover: number | null, onHand: number, leadTimeDays: number) {
  if (onHand <= 0) return "OUT"
  if (daysOfCover === null) return null
  if (daysOfCover <= leadTimeDays) return "CRITICAL"
  if (daysOfCover <= leadTimeDays * 2) return "LOW"
  if (daysOfCover <= LOW_STOCK_WATCH_DAYS) return "WATCH"
  return null
}

/**
 * Generates the daily supply alerts: expiring batches, low stock / stock-out
 * risk, and newly launched schemes.
 *
 * Every alert carries a `dedupeKey` that includes the risk band it describes, so
 * re-running the job is safe (no duplicates) while a product that moves into a
 * worse band still produces a fresh, more urgent notification.
 */
export async function runDailyJobs(
  options: { trigger?: JobTrigger; now?: Date; recordRun?: boolean } = {},
): Promise<DailyJobResult> {
  const trigger = options.trigger ?? "SCHEDULE"
  const now = options.now ?? new Date()
  const recordRun = options.recordRun ?? true
  const startedAt = new Date()

  const jobRun = recordRun
    ? await prisma.jobRun.create({
        data: { job: "DAILY_SUPPLY_ALERTS", trigger, startedAt },
      })
    : null

  const byType: Record<string, JobTypeCount> = {}
  let created = 0
  let skipped = 0
  let productsChecked = 0
  let expiryAlerts = 0
  let lowStockAlerts = 0
  let schemeAlerts = 0

  const finish = async (summary: string) => {
    const finishedAt = new Date()
    if (jobRun) {
      await prisma.jobRun.update({
        where: { id: jobRun.id },
        data: {
          status: "SUCCESS",
          notificationsCreated: created,
          notificationsSkipped: skipped,
          finishedAt,
          summary,
        },
      })
    }
    return finishedAt
  }

  try {
    const stockists = await prisma.organization.findMany({
      where: { type: "STOCKIST", status: "VERIFIED" },
      select: { id: true, name: true },
    })

    const weekAgo = new Date(now.getTime() - 7 * 86_400_000)
    const recentSchemes = await prisma.scheme.findMany({
      where: {
        validFrom: { gte: weekAgo },
        validUntil: { gte: now },
      },
      select: {
        id: true,
        name: true,
        type: true,
        minQuantity: true,
        discountPercent: true,
        freeQuantity: true,
        validUntil: true,
        product: {
          select: {
            name: true,
            manufacturer: {
              select: {
                name: true,
                grantedAccess: { select: { stockistId: true, status: true } },
              },
            },
          },
        },
      },
    })

    for (const stockist of stockists) {
      const insights = await buildStockistInsights(stockist.id, { now })
      productsChecked += insights.products.length

      const pending: NotifyInput[] = []

      // 1. Expiring batches, announced once per risk band. The report already
      // sorts by expiry date, so the most urgent batches come first.
      for (const batch of insights.expiry.batches.filter(
        (row) => row.daysRemaining <= 60 && row.unitsAtRisk > 0,
      ).slice(0, MAX_EXPIRY_ALERTS)) {
        const band = (EXPIRY_BAND_BY_DAYS.find((entry) => batch.daysRemaining <= entry.limit) ?? {
          key: "D90",
        }).key
        const atRisk = batch.unitsAtRisk > 0
        pending.push({
          organizationId: stockist.id,
          type: "EXPIRY",
          severity:
            batch.action === "RETURN_OR_CREDIT" || batch.action === "DISPOSE"
              ? "CRITICAL"
              : "WARNING",
          title:
            batch.daysRemaining <= 0
              ? `${batch.productName} batch ${batch.batchNumber} has expired`
              : `${batch.productName} expires in ${batch.daysRemaining} day${batch.daysRemaining === 1 ? "" : "s"}`,
          message: `Batch ${batch.batchNumber} from ${batch.manufacturerName} holds ${batch.quantity} units${
            atRisk
              ? `, of which about ${Math.round(batch.unitsAtRisk)} may expire unsold`
              : " and is on track to be sold first"
          }. Suggested action: ${batch.actionLabel.toLowerCase()}.`,
          link: "/stockist/expiry",
          dedupeKey: `EXPIRY:${batch.id}:${band}`,
        })
      }

      // 2. Low stock and stock-out risk, worst cover first.
      const lowStockCandidates = insights.products
        .map((product) => ({
          product,
          band: lowStockBand(product.stockOut.daysOfCover, product.onHand, product.leadTimeDays),
        }))
        .filter(
          (entry): entry is { product: (typeof insights.products)[number]; band: string } =>
            entry.band !== null,
        )
        .sort((a, b) => {
          const weight = { OUT: 0, CRITICAL: 1, LOW: 2, WATCH: 3 }
          return weight[a.band as keyof typeof weight] - weight[b.band as keyof typeof weight]
        })
        .slice(0, MAX_LOW_STOCK_ALERTS)

      for (const { product, band } of lowStockCandidates) {
        const { reorder, stockOut } = product
        pending.push({
          organizationId: stockist.id,
          type: "LOW_STOCK",
          severity: band === "OUT" || band === "CRITICAL" ? "CRITICAL" : "WARNING",
          title: `${product.productName} ${stockOut.headline.toLowerCase()}`,
          message: `${reorder.reason} Suggested reorder: ${reorder.suggestedQuantity} units (about ₹${reorder.estimatedCost.toLocaleString("en-IN")}).`,
          link: "/stockist/insights",
          dedupeKey: `LOW_STOCK:${product.productId}:${band}`,
        })
      }

      // 3. Newly launched schemes on products this stockist can buy, best
      // saving first.
      const rankedSchemes = [...recentSchemes].sort(
        (a, b) => b.discountPercent - a.discountPercent,
      )
      let schemeAlertsForStockist = 0
      for (const scheme of rankedSchemes) {
        if (schemeAlertsForStockist >= MAX_SCHEME_ALERTS) break
        const authorized = scheme.product.manufacturer.grantedAccess.some(
          (grant) => grant.stockistId === stockist.id && grant.status === "VERIFIED",
        )
        if (!authorized) continue
        schemeAlertsForStockist += 1
        const benefit =
          scheme.discountPercent > 0
            ? `${scheme.discountPercent}% off`
            : `${scheme.freeQuantity} free units`
        pending.push({
          organizationId: stockist.id,
          type: "SCHEME",
          title: `New scheme on ${scheme.product.name}`,
          message: `${scheme.product.manufacturer.name}: ${scheme.name} — ${benefit} on orders of ${scheme.minQuantity} or more, until ${scheme.validUntil.toLocaleDateString("en-IN")}.`,
          link: "/stockist/catalogue",
          dedupeKey: `SCHEME:${scheme.id}`,
        })
      }

      for (const input of pending) {
        const result = await notify(prisma, input)
        const bucket = byType[input.type] ?? { created: 0, skipped: 0 }
        if (result.created) {
          bucket.created += 1
          created += 1
          if (input.type === "EXPIRY") expiryAlerts += 1
          if (input.type === "LOW_STOCK") lowStockAlerts += 1
          if (input.type === "SCHEME") schemeAlerts += 1
        } else {
          bucket.skipped += 1
          skipped += 1
        }
        byType[input.type] = bucket
      }
    }

    const finishedAt = await finish(
      `Checked ${productsChecked} products across ${stockists.length} stockists. ${expiryAlerts} expiry, ${lowStockAlerts} low stock and ${schemeAlerts} scheme alerts sent (${skipped} already known).`,
    )

    return {
      created,
      skipped,
      byType,
      stockists: stockists.length,
      productsChecked,
      expiryAlerts,
      lowStockAlerts,
      schemeAlerts,
      jobRunId: jobRun?.id ?? null,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
    }
  } catch (error) {
    if (jobRun) {
      await prisma.jobRun.update({
        where: { id: jobRun.id },
        data: {
          status: "FAILED",
          error: error instanceof Error ? error.message : "Unknown error",
          finishedAt: new Date(),
        },
      })
    }
    throw error
  }
}
