import { NextResponse } from "next/server"
import { currentUser, profileUpdateSchema, readProfile } from "@/lib/profile-api"
import { supabaseRequest } from "@/lib/supabase"

export async function GET(request: Request) {
  const user = await currentUser(request)
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  try { return NextResponse.json({ profile: await readProfile(user.id, request.headers.get("authorization")?.slice(7)) }) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load profile" }, { status: 500 }) }
}

export async function PUT(request: Request) {
  const user = await currentUser(request)
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  const parsed = profileUpdateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid profile update" }, { status: 400 })
  const { manufacturer, stockist, retailer, ...profile } = parsed.data
  const token = request.headers.get("authorization")?.slice(7)
  const { response, body } = await supabaseRequest(`/rest/v1/profiles?id=eq.${user.id}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(profile), accessToken: token }, "public")
  if (!response.ok) return NextResponse.json({ error: body?.message ?? "Could not update profile" }, { status: response.status })
  return NextResponse.json({ profile: Array.isArray(body) ? body[0] : body })
}
