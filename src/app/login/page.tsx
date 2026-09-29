"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"

import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import Link from "next/link"
import { ArrowRight, Building2, ShieldCheck, Stethoscope } from "lucide-react"

import { signInSchema } from "@/lib/validation"

const loginSchema = signInSchema

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const fillDemo = (email: string) => {
    setValue("email", email)
    setValue("password", "password123")
    setError(null)
  }

  async function onSubmit(values: z.infer<typeof loginSchema>) {
    setError(null)
    const res = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    })

    if (res?.error) {
      setError("Invalid credentials")
    } else {
      router.push("/")
      router.refresh()
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-[linear-gradient(145deg,oklch(0.2_0.05_220),oklch(0.34_0.1_177))] px-12 py-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 size-96 rounded-full border border-white/10" />
        <div className="relative"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-emerald-300 text-slate-900"><Stethoscope className="size-5" /></div><span className="text-xl font-bold tracking-tight">PharmaLink</span></div><p className="eyebrow mt-24 text-emerald-200">Verified procurement, connected</p><h1 className="mt-4 max-w-xl text-5xl font-semibold leading-[1.08] tracking-tight">The calm center of your medicine supply chain.</h1><p className="mt-6 max-w-lg text-base leading-7 text-white/70">One workspace for licensed manufacturers, trusted stockists, and the orders that keep essential supply moving.</p></div>
        <div className="relative grid grid-cols-3 gap-3 text-sm text-white/70"><div className="rounded-xl border border-white/10 bg-white/5 p-4"><ShieldCheck className="mb-3 size-5 text-emerald-200" /><p>Verified businesses</p></div><div className="rounded-xl border border-white/10 bg-white/5 p-4"><Building2 className="mb-3 size-5 text-emerald-200" /><p>Authorized catalogues</p></div><div className="rounded-xl border border-white/10 bg-white/5 p-4"><ArrowRight className="mb-3 size-5 text-emerald-200" /><p>Traceable fulfilment</p></div></div>
      </section>
      <section className="flex items-center justify-center px-5 py-10 sm:px-10">
      <Card className="surface-card w-full max-w-md border-0">
        <CardHeader>
          <p className="eyebrow">Secure workspace</p>
          <CardTitle className="mt-2 text-3xl font-semibold tracking-tight">Welcome back</CardTitle>
          <p className="text-sm text-muted-foreground">Sign in to your PharmaLink account.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input placeholder="admin@pharmalink.com" {...register("email")} />
              {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <Input type="password" placeholder="••••••••" {...register("password")} />
              {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="h-11 w-full">
              Sign in <ArrowRight className="size-4" />
            </Button>
          </form>
          <div className="mt-6 rounded-xl border border-border/70 bg-muted/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Demo accounts</p>
            <div className="mt-3 grid gap-2">
              {[['admin@pharmalink.com', 'Platform admin'], ['mfr@apex.com', 'Manufacturer'], ['stockist@city.com', 'Stockist']].map(([email, label]) => <button type="button" key={email} onClick={() => fillDemo(email)} className="flex min-h-11 items-center justify-between rounded-lg border border-border/60 bg-background px-3 text-left text-sm transition hover:border-primary/50 hover:bg-primary/5"><span><span className="block font-medium">{label}</span><span className="text-xs text-muted-foreground">{email}</span></span><ArrowRight className="size-4 text-primary" /></button>)}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account? <Link href="/register" className="text-primary hover:underline">Register</Link>
          </p>
        </CardFooter>
      </Card>
      </section>
    </div>
  )
}
