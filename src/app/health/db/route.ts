import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const { error } = await supabaseAdmin.from("profiles").select("id").limit(1)

    if (error) {
      return NextResponse.json({ ok: false, database: "error", error: error.message }, { status: 503 })
    }

    return NextResponse.json({ ok: true, database: "connected" })
  } catch (error) {
    return NextResponse.json(
      { ok: false, database: "not_configured", error: error instanceof Error ? error.message : "Unknown database error" },
      { status: 503 },
    )
  }
}
