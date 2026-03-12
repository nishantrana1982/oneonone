import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-helpers'
import { UserRole } from '@prisma/client'
import { RecurringFrequency } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { DEFAULT_WORK_END, DEFAULT_WORK_START } from '@/lib/timezones'
import { getNextOccurrenceDates } from '@/lib/recurring-dates'

const FALLBACK_TZ = 'Asia/Kolkata'
/** Number of future occurrences to check (e.g. 6 = next 6 weeks for weekly); one-off holiday/leave shouldn't block the whole slot. */
const MAX_OCCURRENCES_TO_CHECK = 6

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

    const availabilityOptions = {
      reporterTimeZone: reporterTz,
      reporterWorkStart: reporterStart,
      reporterWorkEnd: reporterEnd,
      employeeTimeZone: employeeTz,
      employeeWorkStart: employeeStart,
      employeeWorkEnd: employeeEnd,
    }

    // Check up to MAX_OCCURRENCES_TO_CHECK future occurrences; use the first free one (one-off holiday/leave shouldn't block the whole recurring slot)
    const { isDateUnavailableForEitherUser } = await import('@/lib/keka')
    const upcomingDates = getNextOccurrenceDates(dayOfWeek, timeOfDay, frequency, reporterTz, MAX_OCCURRENCES_TO_CHECK)
    let firstFreeDate: Date | null = null
    for (const date of upcomingDates) {
      const kekaUnavailable = await isDateUnavailableForEitherUser(user.id, employeeId, date)
      if (kekaUnavailable) continue
      const free = await isDateTimeFreeForBoth(user.id, employeeId, date, 30, availabilityOptions)
      if (free) {
        firstFreeDate = date
        break
      }
    }
    const firstDate = firstFreeDate ?? upcomingDates[0]!
    const available = firstFreeDate !== null

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
        : `Each of the next ${MAX_OCCURRENCES_TO_CHECK} occurrences has a conflict. Choose another time or create anyway.`,
    })
  } catch (error) {
    console.error('Error fetching recurring availability:', error)
    return NextResponse.json(
      { error: 'Failed to fetch availability' },
      { status: 500 }
    )
  }
}
