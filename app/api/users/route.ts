import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, handleApiError } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import { logUserCreated } from '@/lib/audit'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()
    const users = await prisma.user.findMany({
      include: {
        department: true,
        reportsTo: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(users)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const body = await request.json()
    const { email, name, role, departmentId, reportsToId, country, timeZone, workDayStart, workDayEnd } = body

    const user = await prisma.user.create({
      data: {
        email,
        name,
        role: role || UserRole.EMPLOYEE,
        departmentId: departmentId || null,
        reportsToId: reportsToId || null,
        country: country || null,
        timeZone: timeZone || null,
        workDayStart: workDayStart || null,
        workDayEnd: workDayEnd || null,
      },
    })

    // Audit log
    await logUserCreated(admin.id, user.id, { email, name, role: role || 'EMPLOYEE' })

    return NextResponse.json(user)
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}
