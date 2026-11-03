import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AppShell } from "@/components/app-shell"

export default async function ManufacturerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "MANUFACTURER") {
    redirect("/login")
  }

  return <AppShell role="MANUFACTURER" email={session.user.email ?? ""}>{children}</AppShell>
}
