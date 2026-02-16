import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import { randomBytes } from 'crypto'

export async function POST(request: NextRequest) {
  // Block in production unless explicitly enabled
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ENABLE_TEST_LOGIN !== 'true'
  ) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  try {
    const { role } = await request.json()

    if (!role || !['EMPLOYEE', 'REPORTER', 'SUPER_ADMIN'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // Find or create a test user for this role
    let user = await prisma.user.findFirst({
      where: {
        email: `test-${role.toLowerCase()}@test.com`,
        role: role as UserRole,
      },
    })

    if (!user) {
      // Create test user if doesn't exist
      user = await prisma.user.create({
        data: {
          email: `test-${role.toLowerCase()}@test.com`,
          name: `Test ${role.replace('_', ' ')}`,
          role: role as UserRole,
          isActive: true,
        },
      })
    }

    // Create a session token compatible with NextAuth
    const sessionToken = randomBytes(32).toString('base64url')

    // Store session in database (NextAuth format)
    await prisma.session.create({
      data: {
        sessionToken,
        userId: user.id,
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    })

    // Create response
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    })

    // Set NextAuth session cookie
    const cookieName = process.env.NODE_ENV === 'production' 
      ? '__Secure-next-auth.session-token' 
      : 'next-auth.session-token'

    response.cookies.set(cookieName, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Test login error:', error)
    return NextResponse.json({ error: 'Failed to login' }, { status: 500 })
  }
}
