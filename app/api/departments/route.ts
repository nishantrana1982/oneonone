import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

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
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    const body = await request.json()
    const { name } = body

    const department = await prisma.department.create({
      data: { name },
    })

    return NextResponse.json(department)
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Department with this name already exists' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to create department' }, { status: 500 })
  }
}
