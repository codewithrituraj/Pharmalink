"use client"

import { useEffect, useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type Organization = {
  id: string
  name: string
  type: string
  drugLicense: string
  gstNumber: string
  status: string
}

export default function VerificationsPage() {
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)

  const fetchOrgs = async () => {
    const res = await fetch("/api/admin/verify")
    const data = await res.json()
    setOrgs(data)
    setLoading(false)
  }

  useEffect(() => {
    let mounted = true
    fetch("/api/admin/verify")
      .then((res) => res.json())
      .then((data) => {
        if (mounted) {
          setOrgs(data)
          setLoading(false)
        }
      })
    return () => {
      mounted = false
    }
  }, [])

  const handleAction = async (id: string, action: "VERIFIED" | "REJECTED") => {
    await fetch("/api/admin/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    })
    fetchOrgs() // Refresh list
  }

  if (loading) return <div>Loading...</div>

  return (
    <div className="bg-white rounded-lg shadow border p-6">
      <h2 className="text-xl font-semibold mb-4">Pending Verifications</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Drug License</TableHead>
            <TableHead>GST</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orgs.map((org) => (
            <TableRow key={org.id}>
              <TableCell className="font-medium">{org.name}</TableCell>
              <TableCell>{org.type}</TableCell>
              <TableCell>{org.drugLicense}</TableCell>
              <TableCell>{org.gstNumber}</TableCell>
              <TableCell>
                <Badge variant={org.status === "PENDING" ? "secondary" : org.status === "VERIFIED" ? "default" : "destructive"}>
                  {org.status}
                </Badge>
              </TableCell>
              <TableCell>
                {org.status === "PENDING" && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleAction(org.id, "VERIFIED")}>Approve</Button>
                    <Button size="sm" variant="destructive" onClick={() => handleAction(org.id, "REJECTED")}>Reject</Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
          {orgs.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground h-24">
                No pending verifications.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
