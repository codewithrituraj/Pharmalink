import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AppShell } from "@/components/app-shell"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "ADMIN") {
    redirect("/login")
  }

  return <AppShell role="ADMIN" email={session.user.email ?? ""}>{children}</AppShell>
}
