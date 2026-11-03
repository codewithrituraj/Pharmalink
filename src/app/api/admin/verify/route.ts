import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/access"
import { notify } from "@/lib/notifications"

const decision = z.object({ id: z.string().min(1), action: z.enum(["VERIFIED", "REJECTED", "REVIEW"]), reason: z.string().trim().max(500).optional() }).superRefine((value, ctx) => {
  if (value.action === "REJECTED" && !value.reason) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["reason"], message: "A rejection reason is required" })
})

export async function GET() {
  const auth = await requireRole("ADMIN")
  if ("error" in auth) return auth.error
  const organizations = await prisma.organization.findMany({ include: { documents: true, users: { select: { email: true, isSuspended: true } } }, orderBy: [{ status: "asc" }, { name: "asc" }] })
  return NextResponse.json(organizations)
}

export async function POST(req: Request) {
  const auth = await requireRole("ADMIN")
  if ("error" in auth) return auth.error
  const parsed = decision.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: "Invalid verification decision", details: parsed.error.flatten() }, { status: 400 })
  const org = await prisma.organization.findUnique({ where: { id: parsed.data.id } })
  if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 })
  const updated = await prisma.$transaction(async (tx) => {
    const item = await tx.organization.update({ where: { id: org.id }, data: { status: parsed.data.action, verificationRemark: parsed.data.reason ?? null } })
    await tx.auditLog.create({ data: { actorId: auth.session.user.id, organizationId: org.id, action: `VERIFICATION_${parsed.data.action}`, entityType: "Organization", entityId: org.id, detail: parsed.data.reason ?? null } })
    await notify(tx, { organizationId: org.id, type: "VERIFICATION_DECISION", severity: parsed.data.action === "VERIFIED" ? "INFO" : "WARNING", title: parsed.data.action === "VERIFIED" ? "Registration approved" : parsed.data.action === "REVIEW" ? "More verification information requested" : "Registration declined", message: parsed.data.reason || "Your verification status has been updated.", link: "/stockist" })
    return item
  })
  return NextResponse.json({ success: true, organization: updated })
}
