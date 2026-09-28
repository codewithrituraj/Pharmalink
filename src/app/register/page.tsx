"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"

import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import Link from "next/link"

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  organizationName: z.string().min(2, "Company name is required"),
  type: z.enum(["MANUFACTURER", "STOCKIST"]),
  drugLicense: z.string().min(1, "Drug License is required"),
  gstNumber: z.string().min(1, "GST Number is required"),
})

export default function RegisterPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<boolean>(false)
  
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      organizationName: "",
      type: "STOCKIST",
      drugLicense: "",
      gstNumber: "",
    },
  })

  async function onSubmit(values: z.infer<typeof registerSchema>) {
    setError(null)
    setSuccess(false)
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Registration failed")
        return
      }

      setSuccess(true)
      setTimeout(() => {
        router.push("/login")
      }, 2000)
    } catch {
      setError("An unexpected error occurred")
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 py-12">
      <Card className="w-[500px]">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">PharmaLink</CardTitle>
          <p className="text-sm text-muted-foreground text-center">Register your business</p>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="p-4 mb-4 text-sm text-green-800 rounded-lg bg-green-50">
              Registration successful! Redirecting to login...
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <label className="text-sm font-medium">Admin Email</label>
                  <Input placeholder="contact@company.com" {...register("email")} />
                  {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="text-sm font-medium">Password</label>
                  <Input type="password" placeholder="••••••••" {...register("password")} />
                  {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="text-sm font-medium">Company Name</label>
                  <Input placeholder="Acme Pharma" {...register("organizationName")} />
                  {errors.organizationName && <p className="text-xs text-red-500">{errors.organizationName.message}</p>}
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="text-sm font-medium">Business Type</label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    {...register("type")}
                  >
                    <option value="STOCKIST">Stockist / Wholesaler</option>
                    <option value="MANUFACTURER">Manufacturer</option>
                  </select>
                  {errors.type && <p className="text-xs text-red-500">{errors.type.message}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Drug License Number</label>
                  <Input placeholder="DL-XXX-123" {...register("drugLicense")} />
                  {errors.drugLicense && <p className="text-xs text-red-500">{errors.drugLicense.message}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">GST Number</label>
                  <Input placeholder="27XXXXX1234X1X1" {...register("gstNumber")} />
                  {errors.gstNumber && <p className="text-xs text-red-500">{errors.gstNumber.message}</p>}
                </div>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full">
                Register Business
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            Already have an account? <Link href="/login" className="text-blue-600 hover:underline">Login</Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
