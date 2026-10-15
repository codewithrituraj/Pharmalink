import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AppShell } from "@/components/app-shell"

export default async function StockistLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "STOCKIST") {
    redirect("/login")
  }

  return <AppShell role="STOCKIST" email={session.user.email ?? ""} demo={session.user.email === "stockist@city.com"}>{children}</AppShell>
}
