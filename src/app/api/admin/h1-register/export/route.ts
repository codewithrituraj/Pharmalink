import { requireRole, csv } from "@/lib/access"
import { h1RegisterFilterSchema, h1RegisterWhere } from "@/lib/h1-register"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const auth = await requireRole("ADMIN")
  if ("error" in auth) return auth.error
  const filters = h1RegisterFilterSchema.safeParse(Object.fromEntries(new URL(req.url).searchParams))
  if (!filters.success) return Response.json({ error: "Invalid H1 register filters" }, { status: 400 })

  const entries = await prisma.h1RegisterEntry.findMany({
    where: h1RegisterWhere(filters.data),
    include: { buyer: true, product: true, order: true },
    orderBy: { createdAt: "desc" },
  })
  const body = csv([
    ["Date", "Buyer", "Buyer drug license", "Product", "Composition", "Patient", "Prescriber", "Registration number", "Quantity", "PO"],
    ...entries.map((entry) => [entry.createdAt.toISOString(), entry.buyer.name, entry.buyer.drugLicense, entry.product.name, entry.product.composition, entry.patientName, entry.prescriberName, entry.prescriberRegistrationNumber, entry.quantity, entry.order.poNumber]),
  ])
  return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=admin-h1-register.csv" } })
}