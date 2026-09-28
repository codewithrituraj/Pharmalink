import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type PageHeaderProps = {
  title: string
  description: string
  actions?: ReactNode
  meta?: ReactNode
  className?: string
}

export function PageHeader({ title, description, actions, meta, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
        {meta ? <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}
