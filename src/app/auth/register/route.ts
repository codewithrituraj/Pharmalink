import { NextResponse } from "next/server"
import { profileRegistrationSchema, duplicateMessage } from "@/lib/profile-api"
import { supabaseRequest } from "@/lib/supabase"

export async function POST(request: Request) {
  const parsed = profileRegistrationSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid registration details" }, { status: 400 })
  const input = parsed.data

  const { response: signupResponse, body: signupBody } = await supabaseRequest("/auth/v1/signup", {
    method: "POST",
    body: JSON.stringify({ email: input.email, password: input.password, data: { account_type: input.account_type, full_name: input.full_name, business_name: input.business_name, phone: input.phone } }),
  })
  if (!signupResponse.ok || !signupBody?.user?.id) {
    return NextResponse.json({ error: duplicateMessage(signupBody) ?? (signupResponse.ok ? "Email already registered" : signupBody?.msg ?? signupBody?.message ?? "Registration failed") }, { status: signupResponse.status || 409 })
  }

  const userId = signupBody.user.id as string
  const { response: detailResponse, body: detailBody } = await supabaseRequest("/rest/v1/business_details", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      profile_id: userId,
      gst_no: input.gst_no,
      drug_license_no: input.drug_license_no,
      drug_license_no_secondary: input.drug_license_no_secondary ?? null,
      drug_license_type: input.drug_license_type ?? null,
      drug_license_expiry: input.drug_license_expiry,
      pan_no: input.pan_no ?? null,
      fssai_no: input.fssai_no ?? null,
      address_line1: input.address_line1 ?? null,
      address_line2: input.address_line2 ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      pincode: input.pincode ?? null,
      country: input.country,
    }),
  }, "admin")
  if (!detailResponse.ok) return NextResponse.json({ error: duplicateMessage(detailBody) ?? "Business details could not be saved" }, { status: 409 })

  const rolePayload = input.account_type === "manufacturer" ? input.manufacturer : input.account_type === "stockist" ? input.stockist : input.retailer
  if (rolePayload) {
    const table = `${input.account_type}_details`
    const { response, body } = await supabaseRequest(`/rest/v1/${table}`, { method: "POST", body: JSON.stringify({ profile_id: userId, ...rolePayload }) }, "admin")
    if (!response.ok) return NextResponse.json({ error: body?.message ?? "Role details could not be saved" }, { status: 409 })
  }

  return NextResponse.json({
    ok: true,
    message: "Registration submitted for verification",
    access_token: signupBody.access_token,
    refresh_token: signupBody.refresh_token,
    expires_in: signupBody.expires_in,
    user: signupBody.user,
  }, { status: 201 })
}
