import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string
      organizationId?: string
      organizationType?: string
    } & DefaultSession["user"]
  }

  interface User {
    id: string
    role: string
    organizationId?: string | null
    organizationType?: string
  }
}
