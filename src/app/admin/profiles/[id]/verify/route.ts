import { NextResponse } from "next/server"
import { currentUser, isAdminEmail } from "@/lib/profile-api"
import { supabaseRequest } from "@/lib/supabase"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser(request)
  if (!user || !isAdminEmail(user.email)) return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  const body = await request.json().catch(() => null)
  if (!(["verified", "rejected", "under_review"] as string[]).includes(body?.status)) return NextResponse.json({ error: "Status must be verified, rejected, or under_review" }, { status: 400 })
  if (body.status === "rejected" && !String(body.reason ?? "").trim()) return NextResponse.json({ error: "A rejection reason is required" }, { status: 400 })
  const { id } = await params
  const { response, body: result } = await supabaseRequest(`/rest/v1/profiles?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ verification_status: body.status, rejection_reason: body.status === "rejected" ? body.reason : null }) }, "admin")
  if (!response.ok) return NextResponse.json({ error: result?.message ?? "Could not update verification" }, { status: 500 })
  await supabaseRequest("/rest/v1/verification_logs", { method: "POST", body: JSON.stringify({ profile_id: id, action: body.status === "verified" ? "approved" : body.status, performed_by: user.id, note: body.reason ?? null }) }, "admin")
  return NextResponse.json({ profile: Array.isArray(result) ? result[0] : result })
}
