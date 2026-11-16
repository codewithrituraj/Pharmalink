import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`

    return NextResponse.json({ ok: true, database: "connected" })
  } catch (error) {
    return NextResponse.json(
      { ok: false, database: "not_configured", error: error instanceof Error ? error.message : "Unknown database error" },
      { status: 503 },
    )
  }
}
