import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { notify } from "@/lib/notifications"
import { requireRole } from "@/lib/access"

const decisionSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["VERIFIED", "REJECTED"]),
  customDiscount: z.number().min(0).max(100).optional(),
})

export async function GET() {
  const auth = await requireRole("MANUFACTURER")
  if ("error" in auth) return auth.error

  const grants = await prisma.accessGrant.findMany({
    where: { manufacturerId: auth.session.user.organizationId },
    include: {
      stockist: true,
    },
    orderBy: { status: 'asc' }, // PENDING first
  })

  return NextResponse.json(grants)
}

export async function POST(req: Request) {
  const auth = await requireRole("MANUFACTURER", true)
  if ("error" in auth) return auth.error

  const parsed = decisionSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 })

  // Ensure this grant belongs to the logged in manufacturer
  const grant = await prisma.accessGrant.findUnique({ where: { id: parsed.data.id } })
  if (!grant || grant.manufacturerId !== auth.session.user.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const updatedGrant = await prisma.accessGrant.update({
    where: { id: parsed.data.id },
    data: { status: parsed.data.action, decidedAt: new Date(), customDiscount: parsed.data.action === "VERIFIED" ? parsed.data.customDiscount ?? null : null },
  })

  await notify(prisma, {
    organizationId: grant.stockistId,
    type: "ACCESS_DECISION",
    severity: parsed.data.action === "VERIFIED" ? "INFO" : "WARNING",
    title: parsed.data.action === "VERIFIED" ? "Manufacturer access approved" : "Manufacturer access declined",
    message:
      parsed.data.action === "VERIFIED"
        ? "You can now browse this manufacturer's catalogue and place orders."
        : "The manufacturer declined your access request. You can send a new request with more detail about your territory.",
    link: "/stockist/manufacturers",
  })

  return NextResponse.json({ success: true, grant: updatedGrant })
}
