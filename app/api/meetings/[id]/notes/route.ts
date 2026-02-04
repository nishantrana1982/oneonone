import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const meeting = await prisma.meeting.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        notes: true,
        employeeId: true,
        reporterId: true,
      },
    })

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    // Authorization
    const isParticipant = meeting.employeeId === user.id || meeting.reporterId === user.id
    const isAdmin = user.role === UserRole.SUPER_ADMIN
    if (!isParticipant && !isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    return NextResponse.json({ notes: meeting.notes })
  } catch (error) {
    console.error('Error fetching meeting notes:', error)
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { notes } = body

    const meeting = await prisma.meeting.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        employeeId: true,
        reporterId: true,
      },
    })

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    // Only reporter or admin can edit notes
    const isReporter = meeting.reporterId === user.id
    const isAdmin = user.role === UserRole.SUPER_ADMIN
    if (!isReporter && !isAdmin) {
      return NextResponse.json({ error: 'Only the reporter can edit meeting notes' }, { status: 403 })
    }

    const updated = await prisma.meeting.update({
      where: { id: params.id },
      data: { notes },
      select: { id: true, notes: true },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating meeting notes:', error)
    return NextResponse.json({ error: 'Failed to update notes' }, { status: 500 })
  }
}
