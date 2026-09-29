"use client"

import { useEffect, useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { fetchJson } from "@/lib/client-fetch"

type AccessGrant = {
  id: string
  stockist: {
    name: string
    drugLicense: string
    gstNumber: string
    status: string
  }
  status: string
}

export default function AccessRequestsPage() {
  const [grants, setGrants] = useState<AccessGrant[]>([])
  const [loading, setLoading] = useState(true)

  const fetchGrants = async () => {
    const res = await fetch("/api/manufacturer/access")
    const data = await res.json()
    setGrants(data)
    setLoading(false)
  }

  useEffect(() => {
    let mounted = true
    fetchJson<AccessGrant[]>("/api/manufacturer/access")
      .then((data) => {
        if (mounted) {
          setGrants(data ?? [])
          setLoading(false)
        }
      })
    return () => {
      mounted = false
    }
  }, [])

  const handleAction = async (id: string, action: "VERIFIED" | "REJECTED") => {
    await fetch("/api/manufacturer/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    })
    fetchGrants() // Refresh list
  }

  if (loading) return <div>Loading...</div>

  return (
    <div className="bg-white rounded-lg shadow border p-6">
      <h2 className="text-xl font-semibold mb-4">Stockist Access Requests</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Stockist Name</TableHead>
            <TableHead>Drug License</TableHead>
            <TableHead>Stockist Verification</TableHead>
            <TableHead>Access Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {grants.map((grant) => (
            <TableRow key={grant.id}>
              <TableCell className="font-medium">{grant.stockist.name}</TableCell>
              <TableCell>{grant.stockist.drugLicense}</TableCell>
              <TableCell>
                <Badge variant={grant.stockist.status === "VERIFIED" ? "default" : "secondary"}>
                  {grant.stockist.status}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={grant.status === "PENDING" ? "secondary" : grant.status === "VERIFIED" ? "default" : "destructive"}>
                  {grant.status}
                </Badge>
              </TableCell>
              <TableCell>
                {grant.status === "PENDING" && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleAction(grant.id, "VERIFIED")}>Approve</Button>
                    <Button size="sm" variant="destructive" onClick={() => handleAction(grant.id, "REJECTED")}>Reject</Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
          {grants.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground h-24">
                No access requests found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
