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
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
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
