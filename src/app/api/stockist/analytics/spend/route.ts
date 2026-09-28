import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { buildStockistInsights } from "@/lib/insights"

const querySchema = z.object({
  months: z.coerce.number().int().min(3).max(24).default(12),
})

/** Spend analytics by month, manufacturer and category. */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "STOCKIST" || !session.user.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  )
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid range" }, { status: 400 })
  }

  const insights = await buildStockistInsights(session.user.organizationId, {
    months: parsed.data.months,
  })

  return NextResponse.json({
    generatedAt: insights.spend.generatedAt,
    months: parsed.data.months,
    spend: insights.spend,
    procurement: insights.procurement,
  })
}
