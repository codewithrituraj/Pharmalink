import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { getProductInsight } from "@/lib/insights"

const querySchema = z.object({
  productId: z.string().min(1),
})

/** Demand forecast, stock-out projection and reorder maths for one product. */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "STOCKIST" || !session.user.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  )
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose a product to forecast" }, { status: 400 })
  }

  const insight = await getProductInsight(
    session.user.organizationId,
    parsed.data.productId,
  )
  if (!insight) {
    return NextResponse.json(
      { error: "That product is not in your authorized catalogue" },
      { status: 404 },
    )
  }

  return NextResponse.json({ insight })
}
