"use client"

import { useEffect, useState } from "react"
import { ShieldAlert } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { fetchJson } from "@/lib/client-fetch"

type Violation = {
  id: string
  submittedMrp: number
  ceilingPrice: number
  detectedAt: string
  product: { id: string; name: string; composition: string; packSize: string }
  manufacturer: { id: string; name: string }
  reference: { drugName: string; ceilingPrice: number; effectiveDate: string }
}

export default function CompliancePage() {
  const [violations, setViolations] = useState<Violation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true

    fetchJson<Violation[]>("/api/admin/compliance")
      .then((data) => {
        if (!active) return
        setViolations(data ?? [])
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setError("Could not load live compliance violations.")
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Regulatory oversight</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">NPPA ceiling-price compliance</h1>
        <p className="mt-2 text-muted-foreground">Active product MRP violations matched against effective scheduled-drug reference prices.</p>
      </div>

      <Card className="surface-card border-0">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Current violations</CardTitle>
          <Badge variant={violations.length ? "destructive" : "outline"}>{loading ? "Loading" : violations.length}</Badge>
        </CardHeader>
        <CardContent>
          {error ? <p role="alert" className="py-8 text-center text-sm text-destructive">{error}</p> : loading ? (
            <div className="h-32 animate-pulse rounded-lg bg-muted" />
          ) : violations.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Manufacturer</TableHead><TableHead>Composition / pack</TableHead><TableHead>MRP</TableHead><TableHead>NPPA ceiling</TableHead><TableHead>Detected</TableHead></TableRow></TableHeader>
                <TableBody>
                  {violations.map((violation) => (
                    <TableRow key={violation.id}>
                      <TableCell className="font-medium">{violation.product.name}</TableCell>
                      <TableCell>{violation.manufacturer.name}</TableCell>
                      <TableCell>{violation.product.composition} · {violation.product.packSize}</TableCell>
                      <TableCell className="number text-destructive">₹{violation.submittedMrp.toFixed(2)}</TableCell>
                      <TableCell className="number">₹{violation.ceilingPrice.toFixed(2)}</TableCell>
                      <TableCell>{new Date(violation.detectedAt).toLocaleDateString("en-IN")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-12 text-center">
              <ShieldAlert className="mx-auto size-9 text-emerald-600" />
              <p className="mt-3 font-semibold">No active ceiling-price violations</p>
              <p className="mt-1 text-sm text-muted-foreground">The list refreshes from persisted product checks.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}