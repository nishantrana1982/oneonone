import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { UserRole, MeetingStatus, RecurringFrequency } from '@prisma/client'

function getScheduleId(params: { id?: string }): string | null {
  const id = params?.id
  if (typeof id === 'string' && id.length > 0) return id
  return null
}

/** Cancel all future SCHEDULED meetings linked to this recurring schedule. Returns count cancelled. */
async function cancelFutureMeetingsForSchedule(
  scheduleId: string,
  reporterName: string
): Promise<number> {
  const now = new Date()
  const futureMeetings = await prisma.meeting.findMany({
    where: {
      recurringScheduleId: scheduleId,
      status: MeetingStatus.SCHEDULED,
      meetingDate: { gt: now },
    },
    include: { calendarEvent: true },
  })

  const { deleteCalendarEvent } = await import('@/lib/google-calendar')
  const { notifyMeetingCancelled } = await import('@/lib/notifications')

  let cancelled = 0
  for (const meeting of futureMeetings) {
    if (meeting.calendarEvent) {
      try {
        await deleteCalendarEvent(meeting.calendarEvent.googleEventId, meeting.reporterId)
      } catch (error) {
        console.error('Failed to delete calendar event for meeting', meeting.id, error)
      }
    }
    await prisma.meeting.update({
      where: { id: meeting.id },
      data: { status: MeetingStatus.CANCELLED },
    })
    await notifyMeetingCancelled(
      meeting.employeeId,
      reporterName,
      meeting.meetingDate,
      meeting.id
    )
    cancelled++
  }
  return cancelled
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

    const now = new Date()
    const upcomingMeetingCount = await prisma.meeting.count({
      where: {
        recurringScheduleId: id,
        status: MeetingStatus.SCHEDULED,
        meetingDate: { gt: now },
      },
    })

    return NextResponse.json({ ...schedule, employee, upcomingMeetingCount })
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
    const { frequency, dayOfWeek, timeOfDay, isActive, cancelFutureMeetings } = body

    const isSuperAdmin = user.role === UserRole.SUPER_ADMIN
    const existing = await prisma.recurringSchedule.findFirst({
      where: isSuperAdmin ? { id } : { id, reporterId: user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    let cancelledMeetingCount = 0
    if (isActive === false && cancelFutureMeetings === true) {
      cancelledMeetingCount = await cancelFutureMeetingsForSchedule(
        id,
        user.name || 'Your manager'
      )
    }

    const scheduleChanged =
      (frequency !== undefined && frequency !== existing.frequency) ||
      (dayOfWeek !== undefined && dayOfWeek !== existing.dayOfWeek) ||
      (timeOfDay !== undefined && timeOfDay !== existing.timeOfDay)

    const updateData: Record<string, unknown> = {
      ...(frequency !== undefined && { frequency }),
      ...(dayOfWeek !== undefined && { dayOfWeek }),
      ...(timeOfDay !== undefined && { timeOfDay }),
      ...(isActive !== undefined && { isActive }),
    }

    // Recalculate nextMeetingDate when schedule timing changes
    if (scheduleChanged) {
      const newDay = dayOfWeek ?? existing.dayOfWeek
      const newTime = timeOfDay ?? existing.timeOfDay
      const newFreq = (frequency ?? existing.frequency) as RecurringFrequency
      const newNextDate = recalculateNextMeetingDate(newDay, newTime, newFreq)
      updateData.nextMeetingDate = newNextDate

      // Update any future PROPOSED meetings linked to this schedule
      const now = new Date()
      const futureProposed = await prisma.meeting.findMany({
        where: {
          recurringScheduleId: id,
          status: MeetingStatus.PROPOSED,
          meetingDate: { gt: now },
        },
      })
      for (const m of futureProposed) {
        await prisma.meeting.update({
          where: { id: m.id },
          data: { meetingDate: newNextDate },
        })
      }

      // Send email notification to the employee
      try {
        const employee = await prisma.user.findUnique({
          where: { id: existing.employeeId },
          select: { email: true, name: true },
        })
        if (employee) {
          const { sendRecurringScheduleUpdatedEmail } = await import('@/lib/email')
          await sendRecurringScheduleUpdatedEmail(
            employee.email,
            employee.name,
            user.name,
            newDay,
            newTime,
            newFreq,
          )
        }
      } catch (emailError) {
        console.error('Failed to send schedule update email:', emailError)
      }

      // In-app notification
      try {
        const { createNotification } = await import('@/lib/notifications')
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        await createNotification({
          userId: existing.employeeId,
          type: 'MEETING_SCHEDULED',
          title: 'Recurring Schedule Updated',
          message: `${user.name || 'Your manager'} updated your recurring meeting to ${dayNames[dayOfWeek ?? existing.dayOfWeek]}s at ${timeOfDay ?? existing.timeOfDay}.`,
          link: '/meetings',
        })
      } catch (notifError) {
        console.error('Failed to send schedule update notification:', notifError)
      }
    }

    const schedule = await prisma.recurringSchedule.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ ...schedule, cancelledMeetingCount })
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

    const url = new URL(request.url)
    const cancelFutureMeetings = url.searchParams.get('cancelFutureMeetings') !== 'false'

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

    let cancelledMeetingCount = 0
    if (cancelFutureMeetings) {
      cancelledMeetingCount = await cancelFutureMeetingsForSchedule(
        id,
        user.name || 'Your manager'
      )
    }

    await prisma.recurringSchedule.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({
      success: true,
      message: 'Schedule deleted',
      cancelledMeetingCount,
    })
  } catch (error) {
    console.error('Error deleting recurring schedule:', error)
    return NextResponse.json(
      { error: 'Failed to delete schedule. Please try again.' },
      { status: 500 }
    )
  }
}

function recalculateNextMeetingDate(
  dayOfWeek: number,
  timeOfDay: string,
  frequency: RecurringFrequency
): Date {
  const [hours, minutes] = timeOfDay.split(':').map(Number)
  const IST_OFFSET = 5 * 60 + 30

  const nowUtc = new Date()
  const nowIst = new Date(nowUtc.getTime() + IST_OFFSET * 60 * 1000)

  const todayIst = new Date(nowIst)
  todayIst.setUTCHours(hours, minutes, 0, 0)

  const currentDay = nowIst.getUTCDay()
  let daysUntil = dayOfWeek - currentDay
  if (daysUntil < 0 || (daysUntil === 0 && nowIst >= todayIst)) {
    daysUntil += 7
  }

  const nextIst = new Date(todayIst)
  nextIst.setUTCDate(todayIst.getUTCDate() + daysUntil)

  if (frequency === 'BIWEEKLY' && daysUntil < 7) {
    nextIst.setUTCDate(nextIst.getUTCDate() + 7)
  }

  return new Date(nextIst.getTime() - IST_OFFSET * 60 * 1000)
}
