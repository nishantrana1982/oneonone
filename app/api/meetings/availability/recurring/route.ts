import { NextRequest, NextResponse } from 'next/server'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import { addDays, addWeeks, setHours, setMinutes, setSeconds, setMilliseconds } from 'date-fns'
import { requireRole } from '@/lib/auth-helpers'
import { UserRole } from '@prisma/client'
import { RecurringFrequency } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { DEFAULT_WORK_END, DEFAULT_WORK_START } from '@/lib/timezones'

const FALLBACK_TZ = 'Asia/Kolkata'

/**
 * Compute next occurrence of (dayOfWeek, timeOfDay) in the given timezone.
 * timeOfDay is "HH:mm" in that timezone.
 */
function calculateNextMeetingDate(
  dayOfWeek: number,
  timeOfDay: string,
  frequency: RecurringFrequency,
  timeZone: string
): Date {
  const [hours, minutes] = timeOfDay.split(':').map(Number)
  const now = new Date()
  const zoned = toZonedTime(now, timeZone)
  const currentDay = zoned.getDay()
  let daysUntil = dayOfWeek - currentDay
  if (daysUntil < 0) daysUntil += 7
  else if (daysUntil === 0) {
    const localHour = zoned.getHours()
    const localMin = zoned.getMinutes()
    if (localHour > hours || (localHour === hours && localMin >= minutes)) daysUntil += 7
  }
  let nextLocal = addDays(zoned, daysUntil)
  nextLocal = setHours(nextLocal, hours)
  nextLocal = setMinutes(nextLocal, minutes)
  nextLocal = setSeconds(nextLocal, 0)
  nextLocal = setMilliseconds(nextLocal, 0)
  if (frequency === 'BIWEEKLY' && daysUntil < 7) {
    nextLocal = addWeeks(nextLocal, 1)
  }
  return fromZonedTime(nextLocal, timeZone)
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

    const [reporter, employee] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user.id },
        select: { timeZone: true, workDayStart: true, workDayEnd: true },
      }),
      prisma.user.findUnique({
        where: { id: employeeId },
        select: { timeZone: true, workDayStart: true, workDayEnd: true },
      }),
    ])

    const reporterTz = reporter?.timeZone ?? FALLBACK_TZ
    const reporterStart = reporter?.workDayStart ?? DEFAULT_WORK_START
    const reporterEnd = reporter?.workDayEnd ?? DEFAULT_WORK_END
    const employeeTz = employee?.timeZone ?? FALLBACK_TZ
    const employeeStart = employee?.workDayStart ?? DEFAULT_WORK_START
    const employeeEnd = employee?.workDayEnd ?? DEFAULT_WORK_END

    const firstDate = calculateNextMeetingDate(dayOfWeek, timeOfDay, frequency, reporterTz)
    const availabilityOptions = {
      reporterTimeZone: reporterTz,
      reporterWorkStart: reporterStart,
      reporterWorkEnd: reporterEnd,
      employeeTimeZone: employeeTz,
      employeeWorkStart: employeeStart,
      employeeWorkEnd: employeeEnd,
    }
    const available = await isDateTimeFreeForBoth(user.id, employeeId, firstDate, 30, availabilityOptions)

    const formatted = firstDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: reporterTz,
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
