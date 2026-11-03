"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type Profile = { full_name: string; business_name: string; email: string; phone: string; account_type: string; verification_status: string; rejection_reason?: string | null; business_details?: { city?: string | null; state?: string | null; gst_no?: string } }

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const token = window.localStorage.getItem("pharmalink_access_token")
    if (!token) { setError("Sign in through the Supabase account flow to view this profile."); return }
    fetch("/profile/me", { headers: { Authorization: `Bearer ${token}` } }).then(async (response) => {
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? "Could not load profile")
      setProfile(body.profile)
    }).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load profile"))
  }, [])
  const status = profile?.verification_status ?? "pending"
  return <main className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-slate-950"><div className="mx-auto max-w-3xl space-y-6"><div><p className="eyebrow">Account</p><h1 className="mt-2 text-3xl font-semibold">Business profile</h1><p className="mt-2 text-muted-foreground">Your saved account and verification details.</p></div>{error ? <Card><CardContent className="p-6 text-sm text-red-600">{error}</CardContent></Card> : profile ? <><div className={`rounded-xl border p-4 text-sm ${status === "verified" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : status === "rejected" ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}><strong className="capitalize">Verification: {status.replaceAll("_", " ")}</strong>{status !== "verified" ? <p className="mt-1">Ordering stays unavailable until an administrator verifies this business.</p> : null}{profile.rejection_reason ? <p className="mt-1">Reason: {profile.rejection_reason}</p> : null}</div><Card><CardHeader><CardTitle>{profile.business_name}</CardTitle></CardHeader><CardContent className="grid gap-4 text-sm sm:grid-cols-2"><div><p className="text-muted-foreground">Contact</p><p>{profile.full_name}</p><p>{profile.email}</p><p>{profile.phone}</p></div><div><p className="text-muted-foreground">Account type</p><p className="capitalize">{profile.account_type}</p><p>{profile.business_details?.city}, {profile.business_details?.state}</p><p>GST: {profile.business_details?.gst_no}</p></div></CardContent></Card><Button asChild><Link href="/">Return to workspace</Link></Button></> : <Card><CardContent className="p-6">Loading profile…</CardContent></Card>}</div></main>
}
