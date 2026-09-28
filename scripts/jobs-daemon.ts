import cron from "node-cron"
import { runDailyJobs } from "../src/lib/jobs"

const SCHEDULE = process.env.JOBS_CRON ?? "0 2 * * *"

console.log(`PharmaLink daily supply alerts scheduled on "${SCHEDULE}" (local time).`)

cron.schedule(SCHEDULE, async () => {
  console.log(`[${new Date().toISOString()}] running daily supply alerts...`)
  try {
    const result = await runDailyJobs({ trigger: "SCHEDULE" })
    console.log(
      `  done: ${result.created} created, ${result.skipped} skipped across ${result.stockists} stockists`,
    )
  } catch (error) {
    console.error("  daily supply alerts failed:", error)
  }
})
