import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from './prisma'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
          scope: 'openid email profile https://www.googleapis.com/auth/calendar',
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Restrict to company domain only
      const allowedDomain = process.env.GOOGLE_WORKSPACE_DOMAIN
      if (!allowedDomain) {
        console.warn('GOOGLE_WORKSPACE_DOMAIN not set, allowing all domains')
        return true
      }

      const email = user.email || profile?.email
      if (!email) {
        return false
      }

      const domain = email.split('@')[1]
      if (domain !== allowedDomain) {
        return false
      }

      return true
    },
    async session({ session, user }) {
      if (session.user) {
        // Fetch user from database to get role and other details
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email! },
          select: {
            id: true,
            role: true,
            name: true,
            email: true,
            avatar: true,
            departmentId: true,
            reportsToId: true,
          },
        })

        if (dbUser) {
          session.user.id = dbUser.id
          session.user.role = dbUser.role
          session.user.departmentId = dbUser.departmentId
          session.user.reportsToId = dbUser.reportsToId
        }
      }

      return session
    },
    async jwt({ token, account, user }) {
      if (account && user) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
      }
      return token
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'database',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
}
