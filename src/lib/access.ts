import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export type Role = "ADMIN" | "MANUFACTURER" | "STOCKIST"

/** Shared server-side gate. UI visibility is never used as authorization. */
export async function requireRole(role: Role, requireVerified = false) {
  const session = await getServerSession(authOptions)
  if (!session) return { error: NextResponse.json({ error: "Authentication required" }, { status: 401 }) }
  if (session.user.role !== role) return { error: NextResponse.json({ error: "Forbidden for this role" }, { status: 403 }) }
  if (role !== "ADMIN" && !session.user.organizationId) return { error: NextResponse.json({ error: "Organization is required" }, { status: 403 }) }
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { organization: true } })
  if (!user || user.isSuspended) return { error: NextResponse.json({ error: "Account is suspended" }, { status: 403 }) }
  if (requireVerified && user.organization?.status !== "VERIFIED") {
    return { error: NextResponse.json({ error: "Your organization must be verified before this action" }, { status: 403 }) }
  }
  return { session, user }
}

export function csv(rows: Array<Array<string | number | null | undefined>>) {
  return rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n")
}
