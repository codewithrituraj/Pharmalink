"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"

type AccountType = "manufacturer" | "stockist" | "retailer"

export default function RegisterPage() {
  const router = useRouter()
  const [accountType, setAccountType] = useState<AccountType>("stockist")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const form = new FormData(event.currentTarget)
    const value = (name: string) => String(form.get(name) ?? "").trim()
    const payload: Record<string, unknown> = {
      email: value("email"), password: value("password"), account_type: accountType,
      full_name: value("full_name"), business_name: value("business_name"), phone: value("phone"),
      gst_no: value("gst_no"), drug_license_no: value("drug_license_no"), drug_license_expiry: value("drug_license_expiry"),
      address_line1: value("address_line1"), city: value("city"), state: value("state"), pincode: value("pincode"),
    }
    if (accountType === "retailer") payload.retailer = { store_name: value("store_name"), pharmacist_name: value("pharmacist_name"), pharmacist_registration_no: value("pharmacist_registration_no"), store_type: value("store_type"), preferred_stockist_ids: [] }
    if (accountType === "manufacturer") payload.manufacturer = { manufacturing_license_no: value("drug_license_no"), who_gmp_certified: form.get("who_gmp_certified") === "on", product_categories: [], plant_address: value("address_line1") }
    if (accountType === "stockist") payload.stockist = { warehouse_address: value("address_line1"), cold_chain_available: form.get("cold_chain_available") === "on", serviceable_pincodes: value("pincode") ? [value("pincode")] : [], authorized_manufacturers: [] }
    const response = await fetch("/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) { setError(result.error ?? "Registration failed"); return }
    setSuccess(true)
    window.setTimeout(() => router.push("/login"), 1800)
  }

  return <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950"><Card className="w-full max-w-2xl"><CardHeader><CardTitle className="text-2xl">Create your PharmaLink account</CardTitle><p className="text-sm text-muted-foreground">Your profile will remain pending until the business is verified.</p></CardHeader><CardContent>{success ? <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">Registration submitted. Redirecting to login…</div> : <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
    <label className="space-y-2 text-sm font-medium">Account type<select name="account_type" value={accountType} onChange={(event) => setAccountType(event.target.value as AccountType)} className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="manufacturer">Manufacturer</option><option value="stockist">Stockist / wholesaler</option><option value="retailer">Retail pharmacy</option></select></label>
    <label className="space-y-2 text-sm font-medium">Full name<Input required name="full_name" /></label><label className="space-y-2 text-sm font-medium">Business name<Input required name="business_name" /></label><label className="space-y-2 text-sm font-medium">Phone (E.164)<Input required name="phone" placeholder="+919876543210" /></label><label className="space-y-2 text-sm font-medium sm:col-span-2">Email<Input required type="email" name="email" /></label><label className="space-y-2 text-sm font-medium">Password<Input required minLength={8} type="password" name="password" /></label><label className="space-y-2 text-sm font-medium">GSTIN<Input required name="gst_no" placeholder="27ABCDE1234F1Z5" /></label><label className="space-y-2 text-sm font-medium">Drug licence number<Input required name="drug_license_no" /></label><label className="space-y-2 text-sm font-medium">Licence expiry<Input required type="date" name="drug_license_expiry" /></label><label className="space-y-2 text-sm font-medium sm:col-span-2">Address<Input name="address_line1" /></label><label className="space-y-2 text-sm font-medium">City<Input name="city" /></label><label className="space-y-2 text-sm font-medium">State<Input name="state" /></label><label className="space-y-2 text-sm font-medium">Pincode<Input name="pincode" /></label>
    {accountType === "retailer" ? <><label className="space-y-2 text-sm font-medium">Store name<Input required name="store_name" /></label><label className="space-y-2 text-sm font-medium">Pharmacist name<Input required name="pharmacist_name" /></label><label className="space-y-2 text-sm font-medium">Pharmacist registration no.<Input required name="pharmacist_registration_no" /></label><label className="space-y-2 text-sm font-medium">Store type<select name="store_type" defaultValue="pharmacy" className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="pharmacy">Pharmacy</option><option value="hospital">Hospital</option><option value="clinic">Clinic</option></select></label></> : null}
    {accountType === "manufacturer" ? <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="who_gmp_certified" /> WHO-GMP certified</label> : null}{accountType === "stockist" ? <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="cold_chain_available" /> Cold-chain storage available</label> : null}
    {error ? <p className="text-sm text-red-600 sm:col-span-2">{error}</p> : null}<Button className="sm:col-span-2" type="submit">Submit registration</Button>
  </form>}</CardContent><CardFooter className="justify-center text-sm text-muted-foreground">Already registered? <Link href="/login" className="ml-1 text-primary hover:underline">Sign in</Link></CardFooter></Card></div>
}
