import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { buildStockistInsights } from "@/lib/insights"

/** Expiry manager: FEFO batches with a suggested action for each. */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "STOCKIST" || !session.user.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const insights = await buildStockistInsights(session.user.organizationId)
  const { expiry } = insights

  return NextResponse.json({
    generatedAt: expiry.generatedAt,
    horizonDays: expiry.horizonDays,
    totals: expiry.totals,
    counts: expiry.counts,
    assumptions: expiry.assumptions,
    notes: expiry.notes,
    batches: expiry.batches,
  })
}
