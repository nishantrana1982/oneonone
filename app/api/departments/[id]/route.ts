import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, handleApiError } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin()
    
    const department = await prisma.department.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: { users: true },
        },
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    })

    if (!department) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 })
    }

    return NextResponse.json(department)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin()
    const body = await request.json()
    const { name } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Department name is required' }, { status: 400 })
    }

    const department = await prisma.department.update({
      where: { id: params.id },
      data: { name: name.trim() },
    })

    return NextResponse.json(department)
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error) {
      if ((error as { code: string }).code === 'P2002') {
        return NextResponse.json({ error: 'Department with this name already exists' }, { status: 400 })
      }
      if ((error as { code: string }).code === 'P2025') {
        return NextResponse.json({ error: 'Department not found' }, { status: 404 })
      }
    }
    return NextResponse.json({ error: 'Failed to update department' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin()

    // First, remove department from all users
    await prisma.user.updateMany({
      where: { departmentId: params.id },
      data: { departmentId: null },
    })

    // Then delete the department
    await prisma.department.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to delete department' }, { status: 500 })
  }
}
