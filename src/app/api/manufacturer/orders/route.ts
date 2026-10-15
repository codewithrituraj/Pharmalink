import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/access"
export async function GET(req: Request) { const auth = await requireRole("MANUFACTURER"); if ("error" in auth) return auth.error; const params = new URL(req.url).searchParams; const q = params.get("q")?.trim(); const status = params.get("status")?.trim(); const orders = await prisma.order.findMany({ where: { sellerId: auth.session.user.organizationId!, ...(status ? { status } : {}), ...(q ? { OR: [{ poNumber: { contains: q } }, { buyer: { name: { contains: q } } }] } : {}) }, include: { buyer: { select: { name: true } }, items: { include: { product: { select: { name: true } } } } }, orderBy: { createdAt: "desc" } }); return NextResponse.json(orders) }
