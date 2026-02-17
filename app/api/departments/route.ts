import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, handleApiError } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { logDepartmentCreated } from '@/lib/audit'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()
    const departments = await prisma.department.findMany({
      include: {
        _count: {
          select: { users: true },
        },
      },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(departments)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const body = await request.json()
    const { name } = body

    const department = await prisma.department.create({
      data: { name },
    })

    // Audit log
    await logDepartmentCreated(admin.id, department.id, { name })

    return NextResponse.json(department)
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Department with this name already exists' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to create department' }, { status: 500 })
  }
}
