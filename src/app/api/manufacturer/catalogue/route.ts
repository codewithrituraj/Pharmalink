import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/access"
import { productSchema } from "@/lib/validation"

const importSchema = z.object({ products: z.array(z.unknown()).min(1).max(500) })

/** CSV callers submit parsed rows; every row is validated and reported before any write. */
export async function POST(req: Request) {
  const auth = await requireRole("MANUFACTURER", true)
  if ("error" in auth) return auth.error
  const parsed = importSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: "Upload must contain 1–500 products" }, { status: 400 })
  const report = parsed.data.products.map((row, index) => {
    const result = productSchema.safeParse(row)
    return result.success ? { row: index + 2, valid: true, data: result.data } : { row: index + 2, valid: false, errors: result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) }
  })
  if (report.some((row) => !row.valid)) return NextResponse.json({ imported: 0, report }, { status: 422 })
  await prisma.product.createMany({ data: report.map((row) => {
    const product = (row as { data: z.infer<typeof productSchema> }).data
    return { ...product, imageUrl: product.imageUrl || null, manufacturerId: auth.session.user.organizationId! }
  }) })
  return NextResponse.json({ imported: report.length, report })
}
