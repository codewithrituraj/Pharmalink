import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./prisma"
import { hashPassword, needsRehash, verifyPassword } from "./password"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }
        
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { organization: true }
        })

        if (!user) {
          return null
        }

        if (!(await verifyPassword(credentials.password, user.password))) {
          return null
        }

        // A credential stored before hashing existed, or one written with weaker
        // parameters than the current ones, is upgraded now that we have the
        // plain text in hand. Doing it here rather than in a migration means
        // there is never a window where the stored value is not hashed.
        //
        // The password has already been proved correct, so a failure to write
        // the upgrade must not turn a valid sign in into an error. The
        // credential stays as it is and the next sign in tries again.
        if (needsRehash(user.password)) {
          try {
            const upgraded = await hashPassword(credentials.password)
            await prisma.user.update({ where: { id: user.id }, data: { password: upgraded } })
          } catch (error) {
            console.error("Could not upgrade a stored credential to a hash", error)
          }
        }

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
          organizationType: user.organization?.type
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.organizationId = user.organizationId
        token.organizationType = user.organizationType
      } else if (token.email) {
        // JWT sessions can outlive a local demo reseed. Reconcile the signed
        // identity with the database so an obsolete organization id cannot
        // silently turn every page into an empty account. In production a
        // deleted user is invalidated; email recovery is deliberately limited
        // to the local demo where the seed recreates the documented accounts.
        const current = await prisma.user.findUnique({
          where: { email: token.email },
          include: { organization: true },
        })
        const sameIdentity = current?.id === token.id
        const mayRecoverSeededDemo = process.env.NODE_ENV !== "production"

        if (current && (sameIdentity || mayRecoverSeededDemo)) {
          token.id = current.id
          token.role = current.role
          token.organizationId = current.organizationId
          token.organizationType = current.organization?.type
          token.authError = current.isSuspended ? "ACCOUNT_SUSPENDED" : undefined
        } else {
          token.authError = "ACCOUNT_NOT_FOUND"
          token.id = undefined
          token.role = undefined
          token.organizationId = undefined
          token.organizationType = undefined
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token && !token.authError) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.organizationId = token.organizationId as string
        session.user.organizationType = token.organizationType as string
      }
      return session
    }
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: "jwt"
  },
  secret: process.env.NEXTAUTH_SECRET || "default-secret-for-local-demo"
}
