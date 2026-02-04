import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

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

    const schedule = await prisma.recurringSchedule.findFirst({
      where: {
        id: params.id,
        reporterId: user.id,
      },
      include: {
        meetings: {
          orderBy: { meetingDate: 'desc' },
          take: 10,
        },
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
    return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 })
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

    const body = await request.json()
    const { frequency, dayOfWeek, timeOfDay, isActive } = body

    // Verify ownership
    const existing = await prisma.recurringSchedule.findFirst({
      where: {
        id: params.id,
        reporterId: user.id,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    const schedule = await prisma.recurringSchedule.update({
      where: { id: params.id },
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
    return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 })
  }
}

// Delete a recurring schedule
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify ownership
    const existing = await prisma.recurringSchedule.findFirst({
      where: {
        id: params.id,
        reporterId: user.id,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    // Soft delete by deactivating
    await prisma.recurringSchedule.update({
      where: { id: params.id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting recurring schedule:', error)
    return NextResponse.json({ error: 'Failed to delete schedule' }, { status: 500 })
  }
}
