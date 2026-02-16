import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'

function getScheduleId(params: { id?: string }): string | null {
  const id = params?.id
  if (typeof id === 'string' && id.length > 0) return id
  return null
}

// Get a specific recurring schedule
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const id = getScheduleId(params)
    if (!id) {
      return NextResponse.json({ error: 'Schedule ID is required' }, { status: 400 })
    }

    const isSuperAdmin = user.role === UserRole.SUPER_ADMIN
    const schedule = await prisma.recurringSchedule.findFirst({
      where: isSuperAdmin ? { id } : { id, reporterId: user.id },
      include: {
        meetings: { orderBy: { meetingDate: 'desc' }, take: 10 },
      },
    })

    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    const employee = await prisma.user.findUnique({
      where: { id: schedule.employeeId },
      select: { id: true, name: true, email: true },
    })

    return NextResponse.json({ ...schedule, employee })
  } catch (error) {
    console.error('Error fetching recurring schedule:', error)
    return NextResponse.json(
      { error: 'Failed to fetch schedule' },
      { status: 500 }
    )
  }
}

// Update a recurring schedule
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const id = getScheduleId(params)
    if (!id) {
      return NextResponse.json({ error: 'Schedule ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const { frequency, dayOfWeek, timeOfDay, isActive } = body

    const isSuperAdmin = user.role === UserRole.SUPER_ADMIN
    const existing = await prisma.recurringSchedule.findFirst({
      where: isSuperAdmin ? { id } : { id, reporterId: user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    const schedule = await prisma.recurringSchedule.update({
      where: { id },
      data: {
        ...(frequency !== undefined && { frequency }),
        ...(dayOfWeek !== undefined && { dayOfWeek }),
        ...(timeOfDay !== undefined && { timeOfDay }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return NextResponse.json(schedule)
  } catch (error) {
    console.error('Error updating recurring schedule:', error)
    return NextResponse.json(
      { error: 'Failed to update schedule' },
      { status: 500 }
    )
  }
}

// Delete a recurring schedule (soft delete: set isActive = false)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in again.' }, { status: 401 })
    }

    const id = getScheduleId(params)
    if (!id) {
      return NextResponse.json({ error: 'Schedule ID is required' }, { status: 400 })
    }

    const isSuperAdmin = user.role === UserRole.SUPER_ADMIN
    const whereClause = isSuperAdmin ? { id } : { id, reporterId: user.id }

    const existing = await prisma.recurringSchedule.findFirst({
      where: whereClause,
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Schedule not found. You may not have permission to delete it.' },
        { status: 404 }
      )
    }

    await prisma.recurringSchedule.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true, message: 'Schedule deleted' })
  } catch (error) {
    console.error('Error deleting recurring schedule:', error)
    return NextResponse.json(
      { error: 'Failed to delete schedule. Please try again.' },
      { status: 500 }
    )
  }
}
