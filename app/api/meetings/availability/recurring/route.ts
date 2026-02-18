import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-helpers'
import { UserRole } from '@prisma/client'
import { RecurringFrequency } from '@prisma/client'

function calculateNextMeetingDate(
  dayOfWeek: number,
  timeOfDay: string,
  frequency: RecurringFrequency
): Date {
  const [hours, minutes] = timeOfDay.split(':').map(Number)
  const IST_OFFSET = 5 * 60 + 30 // IST is UTC+5:30

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

/**
 * GET /api/meetings/availability/recurring?employeeId=&dayOfWeek=&timeOfDay=&frequency=
 * Returns whether the first occurrence of this recurring slot is free for both reporter and employee.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireRole([UserRole.REPORTER, UserRole.SUPER_ADMIN])

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const dayOfWeekStr = searchParams.get('dayOfWeek')
    const timeOfDay = searchParams.get('timeOfDay')
    const frequency = (searchParams.get('frequency') as RecurringFrequency) || 'BIWEEKLY'

    if (!employeeId || dayOfWeekStr === null || !timeOfDay) {
      return NextResponse.json(
        { error: 'employeeId, dayOfWeek, and timeOfDay are required' },
        { status: 400 }
      )
    }

    const dayOfWeek = parseInt(dayOfWeekStr, 10)
    if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      return NextResponse.json({ error: 'Invalid dayOfWeek (0-6)' }, { status: 400 })
    }

    const { isCalendarEnabled, isDateTimeFreeForBoth } = await import('@/lib/google-calendar')

    const [reporterConnected, employeeConnected] = await Promise.all([
      isCalendarEnabled(user.id),
      isCalendarEnabled(employeeId),
    ])

    if (!reporterConnected || !employeeConnected) {
      return NextResponse.json({
        available: null,
        firstDate: null,
        calendarUnavailable: true,
        yourCalendarConnected: reporterConnected,
        employeeCalendarConnected: employeeConnected,
        message: !reporterConnected
          ? 'Your Google Calendar is not connected. Connect it to see mutual availability.'
          : "The employee's Google Calendar is not connected. You can still create the schedule.",
      })
    }

    const firstDate = calculateNextMeetingDate(dayOfWeek, timeOfDay, frequency)
    const available = await isDateTimeFreeForBoth(user.id, employeeId, firstDate)

    const formatted = firstDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })

    return NextResponse.json({
      available,
      firstDate: firstDate.toISOString(),
      firstDateFormatted: formatted,
      calendarUnavailable: false,
      yourCalendarConnected: true,
      employeeCalendarConnected: true,
      message: available
        ? `This time is free for both of you. First meeting: ${formatted}`
        : `One or both have a conflict on the first occurrence (${formatted}). Choose another time or create anyway.`,
    })
  } catch (error) {
    console.error('Error fetching recurring availability:', error)
    return NextResponse.json(
      { error: 'Failed to fetch availability' },
      { status: 500 }
    )
  }
}
