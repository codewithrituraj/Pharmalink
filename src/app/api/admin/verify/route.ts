import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const orgs = await prisma.organization.findMany({
    orderBy: { status: 'asc' }, // PENDING first
  })

  return NextResponse.json(orgs)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { id, action } = body

  if (!id || !["VERIFIED", "REJECTED"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }

  const org = await prisma.organization.update({
    where: { id },
    data: { status: action },
  })

  return NextResponse.json({ success: true, org })
}
