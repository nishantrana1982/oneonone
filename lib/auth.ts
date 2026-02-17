import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from './prisma'
import { logLogin } from './audit'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  events: {
    // Ensure name is set when user is created via OAuth
    createUser: async ({ user }) => {
      if (!user.name || user.name === '') {
        const name = user.email?.split('@')[0] || 'User'
        await prisma.user.update({
          where: { id: user.id },
          data: { name },
        })
      }
    },
    // Log sign-in to audit trail
    signIn: async ({ user }) => {
      if (user?.id) {
        await logLogin(user.id)
      }
    },
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Allow same email to sign in again (e.g. after sign-out); only Google is used and domain is restricted
      allowDangerousEmailAccountLinking: true,
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
        
        // Store tokens in database for Calendar API access
        if (account.access_token && account.refresh_token) {
          await prisma.account.updateMany({
            where: {
              userId: user.id,
              provider: 'google',
            },
            data: {
              access_token: account.access_token,
              refresh_token: account.refresh_token,
              expires_at: account.expires_at,
            },
          })
        }
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
  // Allow cookies to work on HTTP (non-HTTPS) in non-production
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' && process.env.NEXTAUTH_URL?.startsWith('https') 
        ? '__Secure-next-auth.session-token' 
        : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production' && process.env.NEXTAUTH_URL?.startsWith('https'),
      },
    },
  },
}
