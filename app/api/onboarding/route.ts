import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Super admins don't need onboarding
    if (user.role === UserRole.SUPER_ADMIN) {
      return NextResponse.json({ error: 'Super admins do not need onboarding' }, { status: 400 })
    }

    const body = await request.json()
    const { departmentId, reportsToId } = body

    if (!reportsToId) {
      return NextResponse.json({ error: 'Reporting manager is required' }, { status: 400 })
    }

    // Verify the manager exists and is a Reporter or Super Admin
    const manager = await prisma.user.findUnique({
      where: { id: reportsToId },
    })

    if (!manager || (manager.role !== UserRole.REPORTER && manager.role !== UserRole.SUPER_ADMIN)) {
      return NextResponse.json({ error: 'Invalid reporting manager' }, { status: 400 })
    }

    // Verify department exists if provided
    if (departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: departmentId },
      })
      if (!department) {
        return NextResponse.json({ error: 'Invalid department' }, { status: 400 })
      }
    }

    // Update user with department and reporting manager
    await prisma.user.update({
      where: { id: user.id },
      data: {
        departmentId: departmentId || null,
        reportsToId: reportsToId,
      },
    })

    return NextResponse.json({ 
      success: true,
      message: 'Onboarding completed successfully',
    })
  } catch (error) {
    console.error('Error completing onboarding:', error)
    return NextResponse.json(
      { error: 'Failed to complete onboarding' },
      { status: 500 }
    )
  }
}
