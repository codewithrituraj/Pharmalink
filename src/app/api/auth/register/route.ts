import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hashPassword } from "@/lib/password"
import { registerSchema } from "@/lib/validation"
import * as z from "zod"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = registerSchema.parse(body)

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: parsed.email },
    })

    if (existingUser) {
      return NextResponse.json({ error: "Email already in use" }, { status: 400 })
    }

    // Create organization and user in a transaction
    const hashed = await hashPassword(parsed.password)
    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: parsed.organizationName,
          type: parsed.type,
          drugLicense: parsed.drugLicense,
          gstNumber: parsed.gstNumber,
          address: parsed.address,
          status: "PENDING", // Requires admin approval
        },
      })

      const user = await tx.user.create({
        data: {
          email: parsed.email,
          password: hashed,
          role: parsed.type, // Map organization type directly to user role
          organizationId: org.id,
        },
      })

      return { org, user }
    })

    return NextResponse.json({ success: true, organizationId: result.org.id })
  } catch (error) {
    if (error instanceof z.ZodError) {
      // The form validates with the same schema, so this is only reached by a
      // direct call. Naming the field that failed is more use than "invalid".
      const first = error.issues[0]
      const field = first?.path.join(".")
      return NextResponse.json(
        { error: field ? `${field}: ${first.message}` : "Invalid form data" },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
