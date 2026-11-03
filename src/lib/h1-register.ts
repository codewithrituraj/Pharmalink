import { z } from "zod"
import type { Prisma } from "@prisma/client"

export const h1RegisterFilterSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  productId: z.string().trim().min(1).optional(),
})

export function h1RegisterWhere(filters: z.infer<typeof h1RegisterFilterSchema>): Prisma.H1RegisterEntryWhereInput {
  const createdAt: Prisma.DateTimeFilter = {}
  if (filters.from) createdAt.gte = filters.from
  if (filters.to) {
    const end = new Date(filters.to)
    end.setHours(23, 59, 59, 999)
    createdAt.lte = end
  }

  return {
    ...(filters.productId ? { productId: filters.productId } : {}),
    ...(filters.from || filters.to ? { createdAt } : {}),
  }
}