import { NextResponse } from "next/server"
import { currentUser } from "@/lib/profile-api"
import { supabaseRequest } from "@/lib/supabase"

const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png"])

export async function POST(request: Request) {
  const user = await currentUser(request)
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  const form = await request.formData()
  const file = form.get("file")
  const kind = form.get("kind")
  const documentKind = kind === "license_document_url" || kind === "gst_certificate_url" ? kind : null
  if (!(file instanceof File) || !documentKind) return NextResponse.json({ error: "Upload a licence or GST document" }, { status: 400 })
  if (!allowedTypes.has(file.type)) return NextResponse.json({ error: "Only PDF, JPG, and PNG files are accepted" }, { status: 415 })
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Documents must be 5 MB or smaller" }, { status: 413 })
  const token = request.headers.get("authorization")?.slice(7)
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "bin"
  const path = `${user.id}/${documentKind}-${Date.now()}.${extension}`
  const upload = await supabaseRequest(`/storage/v1/object/documents/${path}`, { method: "POST", headers: { "Content-Type": file.type, "x-upsert": "false" }, body: await file.arrayBuffer(), accessToken: token }, "public")
  if (!upload.response.ok) return NextResponse.json({ error: upload.body?.message ?? "Document upload failed" }, { status: 500 })
  const update = await supabaseRequest(`/rest/v1/business_details?profile_id=eq.${user.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ [documentKind]: path }), accessToken: token }, "public")
  if (!update.response.ok) return NextResponse.json({ error: "Document uploaded but profile link failed" }, { status: 500 })
  return NextResponse.json({ ok: true, path })
}
