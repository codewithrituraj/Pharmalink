import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/access"
export async function GET() { const auth = await requireRole("ADMIN"); if ("error" in auth) return auth.error; return NextResponse.json(await prisma.auditLog.findMany({ include: { actor: { select: { email: true } }, organization: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 300 })) }
