import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const draftSchema = z.object({
  manufacturerId: z.string().min(1),
  notes: z.string().trim().max(1000).optional().default(""),
  items: z.array(z.object({ productId: z.string().min(1), quantity: z.number().int().positive() })).min(1),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "STOCKIST" || !session.user.organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const drafts = await prisma.cartDraft.findMany({ where: { stockistId: session.user.organizationId }, include: { items: { include: { product: { select: { name: true, ptr: true, manufacturerId: true } } } } }, orderBy: { updatedAt: "desc" } })
  return NextResponse.json(drafts)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "STOCKIST" || !session.user.organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const parsed = draftSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: "Invalid draft" }, { status: 400 })
  const { manufacturerId, notes, items } = parsed.data
  const grant = await prisma.accessGrant.findFirst({ where: { manufacturerId, stockistId: session.user.organizationId, status: "VERIFIED" } })
  if (!grant) return NextResponse.json({ error: "Unauthorized manufacturer" }, { status: 403 })
  const draft = await prisma.cartDraft.create({ data: { stockistId: session.user.organizationId, manufacturerId, notes, items: { create: items } }, include: { items: true } })
  return NextResponse.json({ success: true, draft }, { status: 201 })
}
