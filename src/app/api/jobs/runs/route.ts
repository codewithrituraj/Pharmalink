import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/** Recent runs of the scheduled jobs, so the last execution is visible. */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  const runs = await prisma.jobRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 10,
  })

  return NextResponse.json({
    runs: runs.map((run) => ({
      id: run.id,
      job: run.job,
      status: run.status,
      trigger: run.trigger,
      notificationsCreated: run.notificationsCreated,
      notificationsSkipped: run.notificationsSkipped,
      summary: run.summary,
      error: run.error,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
    })),
  })
}
