import { NextResponse } from "next/server"
import { supabasePublic } from "@/lib/supabase"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    // This is a read-only probe, so it must not require the privileged
    // service-role secret just to report database availability.
    const { error } = await supabasePublic.from("profiles").select("id").limit(1)

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
