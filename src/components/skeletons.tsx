import { cn } from "@/lib/utils"

type SkeletonProps = {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn("animate-pulse rounded-lg bg-muted", className)} />
}

export function StatSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-border bg-card p-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-4 h-7 w-32" />
          <Skeleton className="mt-3 h-3 w-full" />
        </div>
      ))}
    </div>
  )
}

export function CardSkeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-5", className)}>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-2 h-3 w-56" />
      <Skeleton className="mt-6 h-48 w-full" />
    </div>
  )
}
