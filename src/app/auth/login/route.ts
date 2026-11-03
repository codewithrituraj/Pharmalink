import { NextResponse } from "next/server"
import { supabaseRequest } from "@/lib/supabase"
import { profileRegistrationSchema } from "@/lib/profile-api"

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === "string" ? body.email : ""
  const password = typeof body?.password === "string" ? body.password : ""
  if (!profileRegistrationSchema.shape.email.safeParse(email).success || !password) return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
  const { response, body: result } = await supabaseRequest("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) })
  if (!response.ok) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
  return NextResponse.json({ access_token: result.access_token, refresh_token: result.refresh_token, expires_in: result.expires_in, user: result.user })
}
