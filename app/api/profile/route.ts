import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const currentUser = await requireAuth()

    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        phone: true,
        title: true,
        bio: true,
        role: true,
        departmentId: true,
        reportsToId: true,
        department: { select: { id: true, name: true } },
        reportsTo: { select: { id: true, name: true, email: true } },
        createdAt: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('Error fetching profile:', error)
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await requireAuth()

    const body = await request.json()
    const { name, phone, title, bio, departmentId, reportsToId } = body

    // Validate name
    if (name !== undefined && (!name || name.trim().length < 2)) {
      return NextResponse.json({ error: 'Name must be at least 2 characters' }, { status: 400 })
    }

    // Validate phone: only digits, +, -, spaces allowed
    if (phone !== undefined && phone && !/^[0-9+\- ]+$/.test(phone.trim())) {
      return NextResponse.json({ error: 'Phone number must contain only numbers, +, - and spaces' }, { status: 400 })
    }

    // Prevent self-reporting
    if (reportsToId !== undefined && reportsToId === currentUser.id) {
      return NextResponse.json({ error: 'You cannot report to yourself' }, { status: 400 })
    }

    // Validate reportsToId if provided
    if (reportsToId !== undefined && reportsToId !== '' && reportsToId !== null) {
      const manager = await prisma.user.findUnique({
        where: { id: reportsToId },
      })
      if (!manager) {
        return NextResponse.json({ error: 'Selected manager not found' }, { status: 400 })
      }
      // Prevent circular: if the selected manager reports to you
      if (manager.reportsToId === currentUser.id) {
        return NextResponse.json({ error: 'Cannot select a manager who reports to you' }, { status: 400 })
      }
    }

    // Validate departmentId if provided
    if (departmentId !== undefined && departmentId !== '' && departmentId !== null) {
      const dept = await prisma.department.findUnique({
        where: { id: departmentId },
      })
      if (!dept) {
        return NextResponse.json({ error: 'Selected department not found' }, { status: 400 })
      }
    }

    // Build update data
    const updateData: Record<string, string | null> = {}
    if (name !== undefined) updateData.name = name.trim()
    if (phone !== undefined) updateData.phone = phone.trim() || null
    if (title !== undefined) updateData.title = title.trim() || null
    if (bio !== undefined) updateData.bio = bio.trim() || null
    if (departmentId !== undefined) updateData.departmentId = departmentId || null
    if (reportsToId !== undefined) updateData.reportsToId = reportsToId || null

    const updatedUser = await prisma.user.update({
      where: { id: currentUser.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        phone: true,
        title: true,
        bio: true,
        role: true,
        departmentId: true,
        reportsToId: true,
        department: { select: { id: true, name: true } },
        reportsTo: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
