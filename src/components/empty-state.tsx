import type { ReactNode } from "react"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type EmptyStateProps = {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl px-6 py-14 text-center",
        className,
      )}
    >
      <div className="grid size-12 place-items-center rounded-2xl bg-secondary text-primary">
        <Icon className="size-6" />
      </div>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
