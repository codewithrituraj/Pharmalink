import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import CatalogueActions from "./actions"

export default async function CataloguePage() {
  const session = await getServerSession(authOptions)
  
  const products = await prisma.product.findMany({
    where: { manufacturerId: session?.user.organizationId },
    include: { batches: true, complianceViolations: { where: { active: true } } },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="w-full min-w-0 max-w-full space-y-6" style={{ contain: "inline-size" }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold">Product Catalogue</h2>
        <CatalogueActions />
      </div>
      
      <div className="surface-card min-w-0 max-w-full overflow-hidden rounded-lg border p-3 shadow sm:p-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Brand Name</TableHead>
              <TableHead>Generic Name</TableHead>
              <TableHead>MRP (₹)</TableHead>
              <TableHead>PTR (₹)</TableHead>
              <TableHead>PTS (₹)</TableHead>
              <TableHead>Stock Batches</TableHead>
              <TableHead>Compliance</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => {
              const totalStock = p.batches.reduce((sum, b) => sum + b.quantity, 0)
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.genericName}</TableCell>
                  <TableCell>{p.mrp.toFixed(2)}</TableCell>
                  <TableCell>{p.ptr.toFixed(2)}</TableCell>
                  <TableCell>{p.pts.toFixed(2)}</TableCell>
                  <TableCell>
                    {p.batches.length} ({totalStock} units)
                  </TableCell>
                  <TableCell>
                    {p.complianceViolations.length ? (
                      <Badge variant="destructive">Above ceiling</Badge>
                    ) : (
                      <Badge variant="outline">Clear</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.isActive ? "default" : "secondary"}>
                      {p.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                </TableRow>
              )
            })}
            {products.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground h-24">
                  No products in catalogue. Upload a CSV to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
