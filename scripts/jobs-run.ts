import { runDailyJobs } from "../src/lib/jobs"

/**
 * Runs the daily supply-alert job immediately, without waiting for the 02:00
 * schedule. Safe to re-run: alerts are de-duplicated by risk band.
 *
 *   npm run jobs:run
 */
runDailyJobs({ trigger: "MANUAL" })
  .then((result) => {
    console.log(
      [
        `Daily jobs finished in ${new Date(result.finishedAt).toISOString()}`,
        `  stockists checked    ${result.stockists}`,
        `  products checked     ${result.productsChecked}`,
        `  notifications created ${result.created} (${result.skipped} already known)`,
        ...Object.entries(result.byType).map(
          ([type, counts]) =>
            `    ${type.padEnd(16)} ${counts.created} created, ${counts.skipped} skipped`,
        ),
      ].join("\n"),
    )
  })
  .catch((error) => {
    console.error("Daily jobs failed:", error)
    process.exitCode = 1
  })
