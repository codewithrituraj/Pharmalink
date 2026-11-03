import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/access"

const updateSchema = z.object({ id: z.string().min(1), suspended: z.boolean() })
export async function GET(req: Request) {
  const auth = await requireRole("ADMIN"); if ("error" in auth) return auth.error
  const search = new URL(req.url).searchParams.get("q")?.trim() ?? ""
  const users = await prisma.user.findMany({
    where: search ? { OR: [{ email: { contains: search } }, { organization: { name: { contains: search } } }] } : undefined,
    select: {
      id: true,
      email: true,
      role: true,
      organizationId: true,
      isSuspended: true,
      organization: { select: { id: true, name: true, type: true, status: true } },
    },
    orderBy: { email: "asc" },
  })
  return NextResponse.json(users)
}
export async function PATCH(req: Request) {
  const auth = await requireRole("ADMIN"); if ("error" in auth) return auth.error
  const parsed = updateSchema.safeParse(await req.json()); if (!parsed.success) return NextResponse.json({ error: "Invalid user update" }, { status: 400 })
  if (parsed.data.id === auth.session.user.id) return NextResponse.json({ error: "You cannot suspend your own account" }, { status: 409 })
  const user = await prisma.user.update({ where: { id: parsed.data.id }, data: { isSuspended: parsed.data.suspended } })
  await prisma.auditLog.create({ data: { actorId: auth.session.user.id, organizationId: user.organizationId, action: user.isSuspended ? "USER_SUSPENDED" : "USER_REACTIVATED", entityType: "User", entityId: user.id } })
  return NextResponse.json({
    id: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    isSuspended: user.isSuspended,
  })
}
