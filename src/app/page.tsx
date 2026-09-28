import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function Home() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  if (session.user.role === "ADMIN") {
    redirect("/admin")
  } else if (session.user.role === "MANUFACTURER") {
    redirect("/manufacturer")
  } else if (session.user.role === "STOCKIST") {
    redirect("/stockist")
  } else {
    redirect("/login")
  }
}
