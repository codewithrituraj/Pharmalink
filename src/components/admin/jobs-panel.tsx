"use client"

import { useState } from "react"
import Link from "next/link"
import { CalendarClock, CheckCircle2, PlayCircle, RefreshCw, TriangleAlert } from "lucide-react"

import { CardSkeleton } from "@/components/skeletons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useApiResource } from "@/hooks/use-api-resource"
import { useToast } from "@/hooks/use-toast"

type JobRun = {
  id: string
  job: string
  status: "SUCCESS" | "FAILED"
  trigger: "SCHEDULE" | "MANUAL" | "SEED"
  notificationsCreated: number
  notificationsSkipped: number
  summary: string | null
  error: string | null
  startedAt: string
  finishedAt: string | null
}

type JobResult = {
  success: boolean
  created: number
  skipped: number
  stockists: number
  productsChecked: number
  byType: Record<string, { created: number; skipped: number }>
  finishedAt: string
}

export function JobsPanel() {
  const { toast } = useToast()
  const { data, error, loading, refresh } = useApiResource<{ runs: JobRun[] }>("/api/jobs/runs")
  const [running, setRunning] = useState(false)
  const [lastResult, setLastResult] = useState<JobResult | null>(null)

  async function runNow() {
    setRunning(true)
    try {
      const response = await fetch("/api/jobs/run", { method: "POST" })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error ?? "Job run failed")
      setLastResult(payload as JobResult)
      toast({
        title: "Daily supply alerts generated",
        description: `${payload.created} created · ${payload.skipped} already known`,
      })
      refresh()
    } catch (cause) {
      toast({
        title: cause instanceof Error ? cause.message : "Job run failed",
        variant: "destructive",
      })
    } finally {
      setRunning(false)
    }
  }

  return (
    <Card className="surface-card border-0">
      <CardHeader className="gap-4">
        <div>
          <CardTitle>Scheduled supply alerts</CardTitle>
          <CardDescription>
            A daily job that checks every stockist inventory for expiring batches, low cover and scheme
            opportunities. Runs at 02:00 by default and is idempotent: alerts already raised for a risk band are
            not duplicated.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={runNow} disabled={running}>
            <PlayCircle className="size-4" /> {running ? "Running…" : "Run now"}
          </Button>
          <Button variant="outline" onClick={refresh} disabled={running}>
            <RefreshCw className="size-4" /> Refresh history
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {lastResult ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="size-4" /> Last manual run finished{" "}
              {new Date(lastResult.finishedAt).toLocaleString("en-IN")}
            </p>
            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
              <Figure label="Stockists checked" value={String(lastResult.stockists)} />
              <Figure label="Products checked" value={String(lastResult.productsChecked)} />
              <Figure label="Notifications created" value={String(lastResult.created)} />
              <Figure label="Skipped (already known)" value={String(lastResult.skipped)} />
            </div>
            <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
              {Object.entries(lastResult.byType).map(([type, counts]) => (
                <li key={type} className="flex justify-between gap-3">
                  <span>{type.replaceAll("_", " ").toLowerCase()}</span>
                  <span className="number">
                    {counts.created} created · {counts.skipped} skipped
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {error ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {loading ? (
          <CardSkeleton />
        ) : data?.runs.length ? (
          <ul className="divide-y divide-border">
            {data.runs.map((run) => (
              <li key={run.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex min-w-0 items-start gap-3">
                  <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {run.job.replaceAll("_", " ").toLowerCase()}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(run.startedAt).toLocaleString("en-IN")} ·{" "}
                      {run.trigger === "SCHEDULE"
                        ? "scheduled"
                        : run.trigger === "SEED"
                          ? "seed"
                          : "manual"}
                    </p>
                    {run.error ? (
                      <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
                        <TriangleAlert className="size-3" /> {run.error}
                      </p>
                    ) : run.summary ? (
                      <p className="mt-1 text-xs text-muted-foreground">{run.summary}</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={run.status === "SUCCESS" ? "success" : "destructive"}>{run.status}</Badge>
                  <span className="number text-xs text-muted-foreground">
                    {run.notificationsCreated} created · {run.notificationsSkipped} skipped
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl bg-muted/60 p-6 text-center text-sm text-muted-foreground">
            No job runs recorded yet. Trigger one above, or run{" "}
            <code className="rounded bg-background px-1.5 py-0.5 text-xs">npm run jobs:run</code> locally.
          </p>
        )}

        <p className="text-xs leading-5 text-muted-foreground">
          In production the daemon runs the same job on a cron schedule via{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">npm run jobs:daemon</code>. The job writes to the
          notifications table only — no external service is contacted. See{" "}
          <Link href="/stockist/notifications" className="font-medium text-primary hover:underline">
            the notification centre
          </Link>{" "}
          for what a stockist sees.
        </p>
      </CardContent>
    </Card>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background/70 p-3">
      <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="number mt-1 text-lg font-semibold">{value}</p>
    </div>
  )
}
