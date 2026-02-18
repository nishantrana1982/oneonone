import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-helpers'
import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { DEFAULT_WORK_END, DEFAULT_WORK_START, formatWorkHoursLabel } from '@/lib/timezones'

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole([UserRole.REPORTER, UserRole.SUPER_ADMIN])

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const date = searchParams.get('date')

    if (!employeeId) {
      return NextResponse.json(
        { error: 'employeeId query param is required' },
        { status: 400 }
      )
    }

    const { getMutualFreeSlots, isCalendarEnabled } = await import('@/lib/google-calendar')

    const [yourCalendarConnected, employeeCalendarConnected] = await Promise.all([
      isCalendarEnabled(user.id),
      isCalendarEnabled(employeeId),
    ])

    // Calendar status only (no date): when adding/selecting an employee, show if their calendar is connected
    if (!date) {
      const employee = await prisma.user.findUnique({
        where: { id: employeeId },
        select: { name: true },
      })
      return NextResponse.json({
        yourCalendarConnected,
        employeeCalendarConnected,
        employeeName: employee?.name ?? null,
        message:
          !yourCalendarConnected
            ? 'Your Google Calendar is not connected. Sign out and sign in again with Google to see mutual availability.'
            : !employeeCalendarConnected
              ? `${employee?.name ?? 'This person'}'s Google Calendar is not connected. You can still propose a time; they can accept or suggest another.`
              : `Both calendars connected. Pick a date to see free slots.`,
      })
    }

    const parsedDate = new Date(date)
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }

    if (!yourCalendarConnected || !employeeCalendarConnected) {
      return NextResponse.json({
        slots: [],
        calendarUnavailable: true,
        workingHoursLabel: null,
        message: !yourCalendarConnected
          ? 'Your Google Calendar is not connected. Please sign out and sign in again to grant calendar access.'
          : 'The selected employee has not connected their Google Calendar.',
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

    const reporterTz = reporter?.timeZone ?? 'Asia/Kolkata'
    const reporterStart = reporter?.workDayStart ?? DEFAULT_WORK_START
    const reporterEnd = reporter?.workDayEnd ?? DEFAULT_WORK_END
    const employeeTz = employee?.timeZone ?? 'Asia/Kolkata'
    const employeeStart = employee?.workDayStart ?? DEFAULT_WORK_START
    const employeeEnd = employee?.workDayEnd ?? DEFAULT_WORK_END

    const slots = await getMutualFreeSlots(user.id, employeeId, parsedDate, 30, {
      reporterTimeZone: reporterTz,
      reporterWorkStart: reporterStart,
      reporterWorkEnd: reporterEnd,
      employeeTimeZone: employeeTz,
      employeeWorkStart: employeeStart,
      employeeWorkEnd: employeeEnd,
    })

    const workingHoursLabel =
      reporterTz !== employeeTz || reporterStart !== employeeStart || reporterEnd !== employeeEnd
        ? formatWorkHoursLabel(
            { start: reporterStart, end: reporterEnd },
            reporterTz,
            { start: employeeStart, end: employeeEnd },
            employeeTz
          )
        : `Free on both calendars (${reporterStart} – ${reporterEnd} your time)`

    return NextResponse.json({
      slots,
      calendarUnavailable: false,
      workingHoursLabel,
      reporterTimeZone: reporterTz,
    })
  } catch (error) {
    console.error('Error fetching availability:', error)
    return NextResponse.json(
      { error: 'Failed to fetch availability' },
      { status: 500 }
    )
  }
}
