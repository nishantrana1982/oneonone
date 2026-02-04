import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin()

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        department: true,
        reportsTo: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin()
    const body = await request.json()
    const { name, email, role, departmentId, reportsToId, isActive } = body

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: params.id },
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check for email conflicts if email is being changed
    if (email && email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email },
      })
      if (emailExists) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 400 })
      }
    }

    // Prevent circular reporting structure
    if (reportsToId) {
      // Check if the new manager reports to this user (circular dependency)
      const manager = await prisma.user.findUnique({
        where: { id: reportsToId },
      })
      if (manager?.reportsToId === params.id) {
        return NextResponse.json(
          { error: 'Cannot assign manager who reports to this user' },
          { status: 400 }
        )
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: {
        name: name || undefined,
        email: email || undefined,
        role: role as UserRole || undefined,
        departmentId: departmentId === '' ? null : departmentId,
        reportsToId: reportsToId === '' ? null : reportsToId,
        isActive: typeof isActive === 'boolean' ? isActive : undefined,
      },
      include: {
        department: true,
        reportsTo: true,
      },
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin()

    // Soft delete by setting isActive to false
    const user = await prisma.user.update({
      where: { id: params.id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true, user })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}
