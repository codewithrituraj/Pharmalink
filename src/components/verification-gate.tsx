"use client"

import { ReactNode, useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"

export function VerificationGate({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [status, setStatus] = useState<string | null>(null)
  useEffect(() => {
    const token = window.localStorage.getItem("pharmalink_access_token")
    if (!token) return
    fetch("/profile/me", { headers: { Authorization: `Bearer ${token}` } }).then((response) => response.ok ? response.json() : null).then((body) => setStatus(body?.profile?.verification_status ?? null)).catch(() => setStatus(null))
  }, [])
  const orderingRoute = pathname.startsWith("/stockist/catalogue") || pathname.startsWith("/stockist/orders")
  if (orderingRoute && status && status !== "verified") return <div className="mx-auto max-w-2xl px-4 py-16"><div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950"><p className="text-sm font-semibold uppercase tracking-wide">Verification required</p><h1 className="mt-2 text-2xl font-semibold">Ordering is locked until your business is verified.</h1><p className="mt-2 text-sm">Your current status is <span className="font-semibold capitalize">{status.replaceAll("_", " ")}</span>. Complete your profile and wait for an administrator review.</p><Link href="/profile" className="mt-5 inline-flex rounded-lg bg-amber-900 px-4 py-2 text-sm font-semibold text-white">View profile</Link></div></div>
  return <>{status && status !== "verified" ? <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950">Your account is <span className="font-semibold capitalize">{status.replaceAll("_", " ")}</span>; ordering is locked until verification.</div> : null}{children}</>
}
