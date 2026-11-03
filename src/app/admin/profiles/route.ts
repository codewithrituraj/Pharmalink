import { NextResponse } from "next/server"
import { currentUser, isAdminEmail } from "@/lib/profile-api"
import { supabaseRequest } from "@/lib/supabase"

export async function GET(request: Request) {
  const user = await currentUser(request)
  if (!user || !isAdminEmail(user.email)) return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  const status = new URL(request.url).searchParams.get("status")
  const filter = status ? `&verification_status=eq.${encodeURIComponent(status)}` : ""
  const { response, body } = await supabaseRequest(`/rest/v1/profiles?select=*,business_details(*)&order=created_at.desc${filter}`, {}, "admin")
  if (!response.ok) return NextResponse.json({ error: body?.message ?? "Could not load profiles" }, { status: 500 })
  return NextResponse.json({ profiles: body })
}
