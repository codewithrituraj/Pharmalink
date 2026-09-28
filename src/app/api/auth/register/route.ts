import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import * as z from "zod"

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  organizationName: z.string().min(2),
  type: z.enum(["MANUFACTURER", "STOCKIST"]),
  drugLicense: z.string().min(1),
  gstNumber: z.string().min(1),
})

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
    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: parsed.organizationName,
          type: parsed.type,
          drugLicense: parsed.drugLicense,
          gstNumber: parsed.gstNumber,
          status: "PENDING", // Requires admin approval
        },
      })

      const user = await tx.user.create({
        data: {
          email: parsed.email,
          password: parsed.password, // Plain text for demo, use bcrypt in real app
          role: parsed.type, // Map organization type directly to user role
          organizationId: org.id,
        },
      })

      return { org, user }
    })

    return NextResponse.json({ success: true, organizationId: result.org.id })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
