import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-helpers'
import { MeetingStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import { DEFAULT_WORK_END, DEFAULT_WORK_START, formatWorkHoursLabel } from '@/lib/timezones'

/**
 * GET /api/meetings/[id]/availability?date=YYYY-MM-DD
 *
 * Returns mutual free slots for the meeting's reporter & employee on the
 * given date.  Any meeting participant (employee OR reporter) can call this,
 * so the "Suggest New Time" flow works for everyone.
 */
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
      select: { employeeId: true, reporterId: true },
    })

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    const isParticipant =
      user.id === meeting.employeeId || user.id === meeting.reporterId
    if (!isParticipant && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const date = request.nextUrl.searchParams.get('date')
    if (!date) {
      return NextResponse.json(
        { error: 'date query param is required' },
        { status: 400 }
      )
    }

    const parsedDate = new Date(date)
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }

    const { getMutualFreeSlots, isCalendarEnabled } = await import(
      '@/lib/google-calendar'
    )

    const [reporterConnected, employeeConnected] = await Promise.all([
      isCalendarEnabled(meeting.reporterId),
      isCalendarEnabled(meeting.employeeId),
    ])

    if (!reporterConnected || !employeeConnected) {
      return NextResponse.json({
        slots: [],
        calendarUnavailable: true,
        workingHoursLabel: null,
        message: !reporterConnected
          ? "Reporter's Google Calendar is not connected."
          : "Employee's Google Calendar is not connected.",
      })
    }

    const [reporter, employee] = await Promise.all([
      prisma.user.findUnique({
        where: { id: meeting.reporterId },
        select: { timeZone: true, workDayStart: true, workDayEnd: true },
      }),
      prisma.user.findUnique({
        where: { id: meeting.employeeId },
        select: { timeZone: true, workDayStart: true, workDayEnd: true },
      }),
    ])

    const reporterTz = reporter?.timeZone ?? 'Asia/Kolkata'
    const reporterStart = reporter?.workDayStart ?? DEFAULT_WORK_START
    const reporterEnd = reporter?.workDayEnd ?? DEFAULT_WORK_END
    const employeeTz = employee?.timeZone ?? 'Asia/Kolkata'
    const employeeStart = employee?.workDayStart ?? DEFAULT_WORK_START
    const employeeEnd = employee?.workDayEnd ?? DEFAULT_WORK_END

    const calendarSlots = await getMutualFreeSlots(
      meeting.reporterId,
      meeting.employeeId,
      parsedDate,
      30,
      {
        reporterTimeZone: reporterTz,
        reporterWorkStart: reporterStart,
        reporterWorkEnd: reporterEnd,
        employeeTimeZone: employeeTz,
        employeeWorkStart: employeeStart,
        employeeWorkEnd: employeeEnd,
      }
    )

    // Exclude slots that overlap with existing DB meetings.
    // Use reporter's timezone for day boundaries so "Monday" means
    // Monday in the reporter's locale, not UTC midnight-to-midnight.
    const zoned = toZonedTime(parsedDate, reporterTz)
    const yy = zoned.getFullYear(), mm = zoned.getMonth(), dd = zoned.getDate()
    const dayStart = fromZonedTime(new Date(yy, mm, dd, 0, 0, 0, 0), reporterTz)
    const dayEnd = fromZonedTime(new Date(yy, mm, dd + 1, 0, 0, 0, 0), reporterTz)

    const activeStatuses: MeetingStatus[] = [
      MeetingStatus.PROPOSED,
      MeetingStatus.SCHEDULED,
    ]
    const existingMeetings = await prisma.meeting.findMany({
      where: {
        status: { in: activeStatuses },
        meetingDate: { gte: dayStart, lt: dayEnd },
        OR: [
          { employeeId: meeting.employeeId },
          { reporterId: meeting.reporterId },
          { employeeId: meeting.reporterId },
          { reporterId: meeting.employeeId },
        ],
      },
      select: { meetingDate: true },
    })

    const SLOT_MS = 30 * 60 * 1000
    const busyRanges = existingMeetings.map((m) => {
      const start = new Date(m.meetingDate).getTime()
      return { start, end: start + SLOT_MS }
    })

    const slots = calendarSlots.filter((slot) => {
      const slotStart = new Date(slot.start).getTime()
      const slotEnd = new Date(slot.end).getTime()
      return !busyRanges.some(
        (busy) => slotStart < busy.end && slotEnd > busy.start
      )
    })

    const workingHoursLabel =
      reporterTz !== employeeTz ||
      reporterStart !== employeeStart ||
      reporterEnd !== employeeEnd
        ? formatWorkHoursLabel(
            { start: reporterStart, end: reporterEnd },
            reporterTz,
            { start: employeeStart, end: employeeEnd },
            employeeTz
          )
        : `Free on both calendars (${reporterStart} – ${reporterEnd})`

    return NextResponse.json({
      slots,
      calendarUnavailable: false,
      workingHoursLabel,
    })
  } catch (error) {
    console.error('Error fetching meeting availability:', error)
    return NextResponse.json(
      { error: 'Failed to fetch availability' },
      { status: 500 }
    )
  }
}
