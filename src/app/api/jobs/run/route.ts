import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { runDailyJobs } from "@/lib/jobs"

/**
 * Runs the daily supply-alert job on demand.
 *
 * Authorised for admins through the session, and for local automation through
 * the `JOB_RUN_SECRET` header so the job can be triggered from a scheduler or a
 * demo without sitting in the admin UI.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const providedSecret = req.headers.get("x-job-secret")

  const isAdmin = session?.user.role === "ADMIN"
  const hasSecret =
    Boolean(process.env.JOB_RUN_SECRET) && providedSecret === process.env.JOB_RUN_SECRET

  if (!isAdmin && !hasSecret) {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: session ? 403 : 401 },
    )
  }

  try {
    const result = await runDailyJobs({
      trigger: isAdmin ? "MANUAL" : "MANUAL",
    })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Daily jobs failed: ${error.message}`
            : "Daily jobs failed",
      },
      { status: 500 },
    )
  }
}
