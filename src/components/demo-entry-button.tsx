"use client"
import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { PlayCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
export function DemoEntryButton() { const router = useRouter(); const [loading,setLoading]=useState(false); const [error,setError]=useState(""); async function enterDemo(){setLoading(true);setError("");const result=await signIn("credentials",{email:"stockist@city.com",password:"password@123",redirect:false});if(result?.error){setError("The demo is temporarily unavailable.");setLoading(false);return}router.push("/stockist");router.refresh()}return <div><Button type="button" size="lg" className="min-h-12 w-full px-6 sm:w-auto" onClick={enterDemo} disabled={loading}><PlayCircle className="size-5" />{loading?"Opening demo…":"Explore the live demo"}</Button>{error?<p className="mt-2 text-sm text-destructive">{error}</p>:null}</div>}
